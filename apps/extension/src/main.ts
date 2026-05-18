import './style.css';
import { ConvexHttpClient } from 'convex/browser';
import type { Purchase } from '@engage-form/domain';
import { api } from '../../../convex/_generated/api.js';
import type { Id } from '../../../convex/_generated/dataModel.js';
import { EXTENSION_TOKEN_KEY, READY_PURCHASE_KEY, readyPurchaseSummary } from './storage.ts';

type RecentPurchase = {
	id: string;
	status: 'ready';
	organization: string;
	purchaser: string;
	itemDescription: string;
	totalAmount: number;
	lastFilledAt: number | null;
};

type ChromeRuntime = {
	scripting: {
		executeScript(injection: ScriptInjection, callback?: () => void): void;
	};
	tabs: {
		query(
			queryInfo: { active: boolean; currentWindow: boolean },
			callback: (tabs: { id?: number }[]) => void
		): void;
		sendMessage(
			tabId: number,
			message: ExtensionMessage,
			callback?: (response: ExtensionResponse) => void
		): void;
	};
	runtime: {
		lastError?: { message: string };
	};
	storage: {
		local: {
			get(
				keys: string[],
				callback: (
					items: Partial<
						Record<typeof READY_PURCHASE_KEY, Purchase> & Record<typeof EXTENSION_TOKEN_KEY, string>
					>
				) => void
			): void;
			set(
				items: Partial<
					Record<typeof READY_PURCHASE_KEY, Purchase> & Record<typeof EXTENSION_TOKEN_KEY, string>
				>,
				callback?: () => void
			): void;
		};
	};
};

type ScriptInjection = { target: { tabId: number }; files: string[] };

type ExtensionMessage = {
	type: 'ENGAGE_COMPLETE_READY_PURCHASE';
	purchase: Purchase;
};

type ExtensionResponse = {
	ok: boolean;
	message: string;
	step: string;
	filled: number;
	missed: string[];
};

declare const chrome: ChromeRuntime;

const convex = new ConvexHttpClient(readConvexUrl());
const app = document.querySelector<HTMLDivElement>('#app');
let token = '';
let recentPurchases: RecentPurchase[] = [];
let readyPurchase: Purchase | null = null;

if (app === null) throw new Error('App root missing.');

load();

function render(status = '') {
	const summary = readyPurchase === null ? null : readyPurchaseSummary(readyPurchase);
	app!.innerHTML = `
    <main class="popup">
      <section class="head">
        <div>
          <p>Engage Form</p>
          <h1>${token ? 'Recent purchases' : 'Link extension'}</h1>
        </div>
        <strong class="${summary ? 'ready' : 'draft'}">${summary ? 'Selected' : 'Sync'}</strong>
      </section>

      ${
				token
					? `
            <section class="purchase">
              <h2>${summary?.title ?? 'No purchase selected'}</h2>
              <dl>
                <div><dt>Org</dt><dd>${summary?.org ?? '-'}</dd></div>
                <div><dt>Amount</dt><dd>${summary?.amount ?? '-'}</dd></div>
                <div><dt>Event</dt><dd>${summary?.event ?? '-'}</dd></div>
                <div><dt>Recipient</dt><dd>${summary?.recipient ?? '-'}</dd></div>
              </dl>
            </section>
            <section class="purchase-list">
              ${recentPurchases
								.map(
									(purchase) => `
                    <button class="purchase-row ${purchase.lastFilledAt === null ? 'ready' : 'filled'}" data-purchase-id="${purchase.id}" type="button">
                      <span>${purchase.organization}</span>
                      <strong>${purchase.itemDescription || 'Untitled'}</strong>
                      <small>${purchase.purchaser} · ${money(purchase.totalAmount)} · ${purchase.lastFilledAt === null ? 'ready' : 'review reached before'}</small>
                    </button>
                  `
								)
								.join('')}
            </section>
            <button id="refresh" type="button">Refresh</button>
          `
					: `
            <textarea id="token" placeholder="Paste device token"></textarea>
            <button id="connect" type="button">Connect</button>
          `
			}
      <p id="status">${status}</p>
    </main>
  `;

	document.querySelector('#connect')?.addEventListener('click', connect);
	document.querySelector('#refresh')?.addEventListener('click', () => void refresh());
	document.querySelectorAll<HTMLButtonElement>('[data-purchase-id]').forEach((button) => {
		button.addEventListener('click', () => void selectAndFill(button.dataset.purchaseId ?? ''));
	});
}

function load() {
	chrome.storage.local.get([READY_PURCHASE_KEY, EXTENSION_TOKEN_KEY], (items) => {
		token = items[EXTENSION_TOKEN_KEY] ?? '';
		readyPurchase = items[READY_PURCHASE_KEY] ?? null;
		render(token ? 'Syncing...' : 'Create a token in the web app.');
		if (token) void refresh();
	});
}

function connect() {
	const input = document.querySelector<HTMLTextAreaElement>('#token');
	token = input?.value.trim() ?? '';
	if (!token) {
		render('Paste a token first.');
		return;
	}
	chrome.storage.local.set({ [EXTENSION_TOKEN_KEY]: token }, () => {
		void refresh();
	});
}

async function refresh() {
	recentPurchases = (await convex.query(api.extension.listRecentPurchases, {
		token
	})) as RecentPurchase[];
	render(recentPurchases.length === 0 ? 'No ready purchases yet.' : 'Select a purchase to fill.');
}

async function selectAndFill(purchaseId: string) {
	render('Fetching purchase...');
	const purchase = (await convex.query(api.extension.getPurchaseForFill, {
		token,
		id: purchaseId as Id<'purchaseRequests'>
	})) as unknown as Purchase;
	readyPurchase = await prepareFiles(purchase);
	chrome.storage.local.set({ [READY_PURCHASE_KEY]: readyPurchase }, () => {
		fillSelectedPurchase();
	});
}

async function prepareFiles(purchase: Purchase): Promise<Purchase> {
	return {
		...purchase,
		files: await Promise.all(
			purchase.files.map(async (file) => {
				if (!file.url) return file;
				const response = await fetch(file.url);
				const blob = await response.blob();
				return { ...file, dataUrl: await blobToDataUrl(blob) };
			})
		)
	};
}

function fillSelectedPurchase() {
	if (readyPurchase === null) return;
	render('Checking current tab...');
	chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
		const tabId = tabs[0]?.id;
		if (tabId === undefined || readyPurchase === null) {
			render('No active tab.');
			return;
		}
		fillActiveTab(
			tabId,
			{ type: 'ENGAGE_COMPLETE_READY_PURCHASE', purchase: readyPurchase },
			false
		);
	});
}

function fillActiveTab(tabId: number, message: ExtensionMessage, injected: boolean) {
	chrome.tabs.sendMessage(tabId, message, (response) => {
		if (chrome.runtime.lastError !== undefined) {
			if (injected) {
				render('Open the Engage form first.');
				return;
			}
			injectContentScript(tabId, message);
			return;
		}
		const missed = response.missed.length > 0 ? ` Missed: ${response.missed.join(', ')}.` : '';
		render(`${response.message} Step: ${response.step}. Filled: ${response.filled}.${missed}`);
	});
}

function injectContentScript(tabId: number, message: ExtensionMessage) {
	chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] }, () => {
		if (chrome.runtime.lastError !== undefined) {
			render('Open the Engage form first.');
			return;
		}
		fillActiveTab(tabId, message, true);
	});
}

function blobToDataUrl(blob: Blob) {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result !== 'string') {
				reject(new Error('File could not be encoded.'));
				return;
			}
			resolve(reader.result);
		};
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});
}

function money(value: number) {
	return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function readConvexUrl() {
	const env = import.meta.env.PUBLIC_CONVEX_URL ?? import.meta.env.VITE_CONVEX_URL;
	if (typeof env !== 'string' || env.trim() === '') {
		throw new Error('Missing PUBLIC_CONVEX_URL for extension.');
	}
	return env;
}
