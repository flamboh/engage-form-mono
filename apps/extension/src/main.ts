import './style.css';
import { ConvexClient } from 'convex/browser';
import { api } from '../../../convex/_generated/api.js';
import type { Id } from '../../../convex/_generated/dataModel.js';
import type { ExtensionResponse } from './content-runner.ts';

type ReadyPurchaseRequest = {
	id: Id<'purchaseRequests'>;
	status: 'ready';
	organization: string;
	purchaser: string;
	itemDescription: string;
	totalAmount: number;
	updatedAt: number;
	lastFilledAt: number | null;
};

type RuntimeMessage =
	| { type: 'ENGAGE_START_FILL'; purchaseId: string }
	| { type: 'ENGAGE_AUTH_STATE' }
	| { type: 'ENGAGE_GET_CONVEX_TOKEN' }
	| { type: 'ENGAGE_SIGN_OUT' };

type AuthStateResponse = { ok: true; signedIn: boolean; email: string | null } | ErrorResponse;
type TokenResponse = { ok: true; token: string | null } | ErrorResponse;
type SignOutResponse = { ok: true; message: string } | ErrorResponse;
type ErrorResponse = { ok: false; message: string };

type ChromeRuntime = {
	runtime: {
		lastError?: { message: string };
		sendMessage(
			message: RuntimeMessage,
			callback: (
				response: ExtensionResponse | AuthStateResponse | TokenResponse | SignOutResponse
			) => void
		): void;
	};
	tabs: {
		create(createProperties: { url: string }): void;
	};
};

declare const chrome: ChromeRuntime;

const app = document.querySelector<HTMLDivElement>('#app');
if (app === null) throw new Error('App root missing.');

const webAppUrl = readWebAppUrl();
const convex = new ConvexClient(readConvexUrl());

let readyPurchaseRequests: ReadyPurchaseRequest[] = [];
let statusMessage = 'Loading...';
let signedIn = false;
let signedInEmail: string | null = null;
let signedOutStatusMessage =
	'OAuth opens in the browser, then this popup uses the synced Clerk session.';
let unsubscribeReady: { unsubscribe(): void } | null = null;

convex.setAuth(requestConvexToken);

void refreshAuthState().catch((error: unknown) => {
	signedOutStatusMessage = error instanceof Error ? error.message : String(error);
	render();
});

document.addEventListener('visibilitychange', () => {
	if (document.visibilityState === 'visible') void refreshAuthState();
});

function subscribeReadyPurchases() {
	if (unsubscribeReady !== null) return;
	statusMessage = 'Loading...';
	unsubscribeReady = convex.onUpdate(
		api.authed.extension.listReadyPurchases,
		{},
		(purchases) => {
			readyPurchaseRequests = purchases;
			statusMessage =
				purchases.length === 0
					? 'No ready purchase requests yet.'
					: 'Select a purchase request to fill.';
			render();
		},
		(error) => {
			statusMessage = error.message;
			render();
		}
	);
}

function clearReadySubscription() {
	unsubscribeReady?.unsubscribe();
	unsubscribeReady = null;
}

function render() {
	if (!signedIn) {
		app!.innerHTML = `
			<main class="popup">
				<section class="head">
					<div>
						<p>Engage Form</p>
						<h1>Sign in</h1>
					</div>
					<strong class="draft">Auth</strong>
				</section>
				<div class="actions">
					<button id="sign-in-web" type="button">Sign in on web</button>
				</div>
				<p id="status">${escapeHtml(signedOutStatusMessage)}</p>
			</main>
		`;
		document.querySelector('#sign-in-web')?.addEventListener('click', () => {
			signedOutStatusMessage = 'Finish sign-in in the browser, then reopen this popup.';
			render();
			chrome.tabs.create({ url: `${webAppUrl}/app` });
		});
		return;
	}

	app!.innerHTML = `
		<main class="popup">
			<section class="head">
				<div>
					<p>Engage Form</p>
					<h1>Ready requests</h1>
				</div>
				<strong class="ready">Live</strong>
			</section>
			<section class="purchase-list">
				${
					readyPurchaseRequests.length === 0
						? '<p class="empty">No ready purchase requests.</p>'
						: readyPurchaseRequests.map(purchaseButton).join('')
				}
			</section>
			<div class="actions">
				<button id="open-web" class="secondary" type="button">Open web app</button>
				<button id="sign-out" class="secondary" type="button">Sign out</button>
			</div>
			<p id="status">${escapeHtml(statusMessage)}</p>
			${signedInEmail === null ? '' : `<p class="muted">${escapeHtml(signedInEmail)}</p>`}
		</main>
	`;

	document.querySelector('#sign-out')?.addEventListener('click', () => {
		void signOut();
	});
	document.querySelector('#open-web')?.addEventListener('click', () => {
		chrome.tabs.create({ url: `${webAppUrl}/app` });
	});
	document.querySelectorAll<HTMLButtonElement>('[data-purchase-id]').forEach((button) => {
		button.addEventListener('click', () => void fillPurchase(button.dataset.purchaseId ?? ''));
	});
}

function purchaseButton(purchase: ReadyPurchaseRequest) {
	return `
		<button class="purchase-row ${purchase.lastFilledAt === null ? 'ready' : 'filled'}" data-purchase-id="${purchase.id}" type="button">
			<span>${escapeHtml(purchase.organization)}</span>
			<strong>${escapeHtml(purchase.itemDescription || 'Untitled')}</strong>
			<small>${escapeHtml(purchase.purchaser)} · ${money(purchase.totalAmount)} · ${
				purchase.lastFilledAt === null ? 'ready' : 'review reached before'
			}</small>
		</button>
	`;
}

async function fillPurchase(purchaseId: string) {
	statusMessage = 'Checking current tab...';
	render();
	const response = await sendStartFill(purchaseId);
	const missed = response.missed.length > 0 ? ` Missed: ${response.missed.join(', ')}.` : '';
	statusMessage = `${response.message} Step: ${response.step}. Filled: ${response.filled}.${missed}`;
	render();
}

function sendStartFill(purchaseId: string) {
	return new Promise<ExtensionResponse>((resolve) => {
		chrome.runtime.sendMessage({ type: 'ENGAGE_START_FILL', purchaseId }, (response) => {
			const error = chrome.runtime.lastError;
			if (error !== undefined) {
				resolve({
					ok: false,
					message: error.message,
					step: 'unknown',
					filled: 0,
					missed: []
				});
				return;
			}
			resolve(response as ExtensionResponse);
		});
	});
}

async function refreshAuthState() {
	const response = await sendRuntimeMessage<AuthStateResponse>({ type: 'ENGAGE_AUTH_STATE' });
	if (!response.ok) throw new Error(response.message);

	signedIn = response.signedIn;
	signedInEmail = response.email;

	if (!signedIn) {
		clearReadySubscription();
		readyPurchaseRequests = [];
	}

	render();
	if (signedIn) subscribeReadyPurchases();
}

async function requestConvexToken() {
	const response = await sendRuntimeMessage<TokenResponse>({ type: 'ENGAGE_GET_CONVEX_TOKEN' });
	if (!response.ok) throw new Error(response.message);
	return response.token;
}

async function signOut() {
	statusMessage = 'Signing out...';
	render();
	const response = await sendRuntimeMessage<SignOutResponse>({ type: 'ENGAGE_SIGN_OUT' });
	if (!response.ok) {
		statusMessage = response.message;
		render();
		return;
	}
	await refreshAuthState();
}

function sendRuntimeMessage<Response>(message: RuntimeMessage) {
	return new Promise<Response>((resolve, reject) => {
		chrome.runtime.sendMessage(message, (response) => {
			const error = chrome.runtime.lastError;
			if (error !== undefined) {
				reject(new Error(error.message));
				return;
			}
			resolve(response as Response);
		});
	});
}

function money(value: number) {
	return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function escapeHtml(value: string) {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function readConvexUrl() {
	const env = import.meta.env.PUBLIC_CONVEX_URL ?? import.meta.env.VITE_CONVEX_URL;
	if (typeof env !== 'string' || env.trim() === '') {
		throw new Error('Missing PUBLIC_CONVEX_URL for extension.');
	}
	return env;
}

function readWebAppUrl() {
	const env = import.meta.env.PUBLIC_WEB_APP_URL ?? 'http://localhost:3676';
	if (typeof env !== 'string' || env.trim() === '') {
		throw new Error('Missing PUBLIC_WEB_APP_URL for extension.');
	}
	return env.replace(/\/$/, '');
}
