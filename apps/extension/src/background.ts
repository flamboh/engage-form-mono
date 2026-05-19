import { createClerkClient } from '@clerk/chrome-extension/client';
import type { PurchaseRequest } from '@engage-form/domain';
import { ConvexClient } from 'convex/browser';
import { api } from '../../../convex/_generated/api.js';
import type { Id } from '../../../convex/_generated/dataModel.js';
import type { ExtensionMessage, ExtensionResponse } from './content-runner.ts';

type RuntimeMessage =
	| { type: 'ENGAGE_START_FILL'; purchaseId: string }
	| { type: 'ENGAGE_GET_READY_PURCHASE'; purchaseId: string }
	| { type: 'ENGAGE_REVIEW_REACHED'; purchaseId: string }
	| { type: 'ENGAGE_FILL_RUN_ENDED' }
	| { type: 'ENGAGE_AUTH_STATE' }
	| { type: 'ENGAGE_GET_CONVEX_TOKEN' }
	| { type: 'ENGAGE_SIGN_OUT' };

type RuntimeResponse =
	| ExtensionResponse
	| { ok: true; purchase: PurchaseRequest }
	| { ok: true; message: string }
	| { ok: true; signedIn: boolean; email: string | null }
	| { ok: true; token: string | null }
	| { ok: false; message: string };

type ChromeApi = {
	runtime: {
		getURL(path: string): string;
		lastError?: { message: string };
		onMessage: {
			addListener(
				callback: (
					message: RuntimeMessage,
					sender: unknown,
					sendResponse: (response: RuntimeResponse) => void
				) => boolean | void
			): void;
		};
	};
	scripting: {
		executeScript(
			injection: { target: { tabId: number }; files: string[] },
			callback: () => void
		): void;
	};
	tabs: {
		query(
			queryInfo: { active: boolean; currentWindow: boolean },
			callback: (tabs: { id?: number }[]) => void
		): void;
		sendMessage(
			tabId: number,
			message: ExtensionMessage,
			callback: (response: ExtensionResponse) => void
		): void;
	};
};

declare const chrome: ChromeApi;

let clerk = createSyncedClerk();
const convex = new ConvexClient(readConvexUrl());
const documentDataUrls = new Map<string, string>();
let activePurchaseId: string | null = null;

convex.setAuth(getConvexToken);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	void handleRuntimeMessage(message)
		.then(sendResponse)
		.catch((error: unknown) => {
			sendResponse({
				ok: false,
				message: error instanceof Error ? error.message : String(error)
			});
		});
	return true;
});

async function handleRuntimeMessage(message: RuntimeMessage): Promise<RuntimeResponse> {
	if (message.type === 'ENGAGE_AUTH_STATE') {
		const client = await refreshClerk();
		return {
			ok: true,
			signedIn: client.session !== null,
			email: client.user?.primaryEmailAddress?.emailAddress ?? null
		};
	}

	if (message.type === 'ENGAGE_GET_CONVEX_TOKEN') {
		return { ok: true, token: await getConvexToken() };
	}

	if (message.type === 'ENGAGE_SIGN_OUT') {
		await (await clerk).signOut();
		await refreshClerk();
		clearActiveFillRun();
		return { ok: true, message: 'Signed out.' };
	}

	if (message.type === 'ENGAGE_FILL_RUN_ENDED') {
		clearActiveFillRun();
		return { ok: true, message: 'Fill run ended.' };
	}

	if (message.type === 'ENGAGE_GET_READY_PURCHASE') {
		return {
			ok: true,
			purchase: await getPreparedPurchase(message.purchaseId)
		};
	}

	if (message.type === 'ENGAGE_REVIEW_REACHED') {
		await convex.mutation(api.authed.extension.markReviewReached, {
			id: message.purchaseId as Id<'purchaseRequests'>
		});
		clearActiveFillRun();
		return { ok: true, message: 'Marked review reached.' };
	}

	return await fillActiveTab(message.purchaseId);
}

async function getConvexToken() {
	return (await clerk).session?.getToken({ template: 'convex' }) ?? null;
}

function createSyncedClerk() {
	return createClerkClient({
		publishableKey: readClerkPublishableKey(),
		syncHost: readClerkSyncHost(),
		background: true
	});
}

function refreshClerk() {
	clerk = createSyncedClerk();
	return clerk;
}

async function fillActiveTab(purchaseId: string): Promise<ExtensionResponse> {
	const purchase = await getPreparedPurchase(purchaseId);
	const tabId = await currentTabId();
	const message: ExtensionMessage = {
		type: 'ENGAGE_COMPLETE_READY_PURCHASE',
		purchase
	};

	try {
		return await sendFillMessage(tabId, message);
	} catch {
		await injectContentScript(tabId);
		return await sendFillMessage(tabId, message);
	}
}

async function currentTabId() {
	return await new Promise<number>((resolve, reject) => {
		chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
			const tabId = tabs[0]?.id;
			if (tabId === undefined) {
				reject(new Error('No active tab.'));
				return;
			}
			resolve(tabId);
		});
	});
}

async function injectContentScript(tabId: number) {
	await new Promise<void>((resolve, reject) => {
		chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] }, () => {
			const error = chrome.runtime.lastError;
			if (error !== undefined) {
				reject(new Error('Open the Engage form first.'));
				return;
			}
			resolve();
		});
	});
}

async function sendFillMessage(tabId: number, message: ExtensionMessage) {
	return await new Promise<ExtensionResponse>((resolve, reject) => {
		chrome.tabs.sendMessage(tabId, message, (response) => {
			const error = chrome.runtime.lastError;
			if (error !== undefined) {
				reject(new Error(error.message));
				return;
			}
			resolve(response);
		});
	});
}

async function getPreparedPurchase(purchaseId: string): Promise<PurchaseRequest> {
	if (activePurchaseId !== purchaseId) {
		clearActiveFillRun();
		activePurchaseId = purchaseId;
	}

	const purchase = (await convex.query(api.authed.extension.getReadyPurchaseForFill, {
		id: purchaseId as Id<'purchaseRequests'>
	})) as unknown as PurchaseRequest;

	return {
		...purchase,
		documents: await Promise.all(
			purchase.documents.map(async (document) => {
				if (!document.url) return document;
				const cached = documentDataUrls.get(document.id);
				if (cached !== undefined) return { ...document, dataUrl: cached };
				const dataUrl = await downloadDocumentDataUrl(document.url, document.filename);
				documentDataUrls.set(document.id, dataUrl);
				return { ...document, dataUrl };
			})
		)
	};
}

async function downloadDocumentDataUrl(url: string, filename: string) {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`Document unavailable: ${filename}.`);
	return await blobToDataUrl(await response.blob());
}

function blobToDataUrl(blob: Blob) {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result !== 'string') {
				reject(new Error('Document could not be encoded.'));
				return;
			}
			resolve(reader.result);
		};
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});
}

function clearActiveFillRun() {
	activePurchaseId = null;
	documentDataUrls.clear();
}

function readConvexUrl() {
	const env = import.meta.env.PUBLIC_CONVEX_URL ?? import.meta.env.VITE_CONVEX_URL;
	if (typeof env !== 'string' || env.trim() === '') {
		throw new Error('Missing PUBLIC_CONVEX_URL for extension.');
	}
	return env;
}

function readClerkPublishableKey() {
	const env = import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY;
	if (typeof env !== 'string' || env.trim() === '') {
		throw new Error('Missing PUBLIC_CLERK_PUBLISHABLE_KEY for extension.');
	}
	return env;
}

function readClerkSyncHost() {
	const env = import.meta.env.PUBLIC_CLERK_SYNC_HOST ?? import.meta.env.PUBLIC_WEB_APP_URL;
	if (typeof env === 'string' && env.trim() !== '') {
		const host = env.replace(/\/$/, '');
		if (new URL(host).hostname === 'localhost') return 'http://localhost';
		return host;
	}
	return 'http://localhost';
}
