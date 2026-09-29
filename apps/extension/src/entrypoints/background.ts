import type { Document } from '@engage-form/domain';
import { isEngageFormUrl } from '@engage-form/fill-engine';
import { browser, type Browser } from 'wxt/browser';
import { readConvexSiteUrl, readWebAppUrl } from '../lib/env';
import { createExtensionApi, ExtensionAuthError } from '../lib/extension-api';
import { createFillRunCache } from '../lib/fill-run-cache';
import type {
	ExternalMessage,
	ExternalResponse,
	FillMessage,
	FillResponse,
	RuntimeMessage,
	RuntimeResponse
} from '../lib/messages';
import type { PendingFillState } from '../lib/pending-fill';
import { createReviewOutbox } from '../lib/review-outbox';

type Connection = { token: string; sessionId: string };

const connectionKey = 'extensionConnection';
const signedOutKey = 'extensionSignedOut';
const reviewAlarm = 'reviewReachedRetry';
const documentTimeoutMs = 60_000;

let services: ReturnType<typeof createServices> | null = null;

function createServices() {
	const api = createExtensionApi(readConvexSiteUrl());
	return {
		api,
		fillRunCache: createFillRunCache({
			stores: [browser.storage.session, browser.storage.local],
			fetchPurchase: async (purchaseId) => await api.purchase(await requireToken(), purchaseId),
			fetchDocument: downloadDocument,
			now: Date.now
		}),
		reviewOutbox: createReviewOutbox({
			storage: browser.storage.local,
			send: async (purchaseId) => {
				await api.reviewReached(await requireToken(), purchaseId);
			},
			now: Date.now
		})
	};
}

function background() {
	services ??= createServices();
	return services;
}

export default defineBackground(() => {
	browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
		const runtimeMessage = message as RuntimeMessage;
		void handleRuntimeMessage(runtimeMessage)
			.catch((error: unknown) => errorResponse(error))
			.then((response) => {
				logBackground(runtimeMessage.type, summarizeResponse(response));
				sendResponse(response);
			});
		void flushReviews();
		return true;
	});

	browser.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
		if (!isWebAppSender(sender)) {
			sendResponse({ ok: false, message: 'Unknown sender.' } satisfies ExternalResponse);
			return false;
		}
		void handleExternalMessage(message as ExternalMessage)
			.catch((error: unknown) => ({ ok: false, message: errorResponse(error).message }) as const)
			.then(sendResponse);
		return true;
	});

	browser.alarms.onAlarm.addListener((alarm) => {
		if (alarm.name === reviewAlarm) void flushReviews();
	});
	browser.runtime.onStartup.addListener(() => void startUp());
	browser.runtime.onInstalled.addListener(() => void startUp());
});

async function startUp() {
	await background().fillRunCache.currentRun();
	await flushReviews();
}

async function handleRuntimeMessage(message: RuntimeMessage): Promise<RuntimeResponse> {
	switch (message.type) {
		case 'AUTH_STATE':
			return { ok: true, signedIn: (await readConnection()) !== null };
		case 'CONNECT':
			await browser.storage.local.remove(signedOutKey);
			await browser.tabs.create({ url: `${readWebAppUrl()}/app/settings?connect=1#extension` });
			return { ok: true, message: 'Opening Engage Form to connect.' };
		case 'SIGN_OUT':
			await signOut();
			return { ok: true, message: 'Signed out.' };
		case 'GET_PENDING_FILL':
			return { ok: true, pendingFillState: await pendingFillState() };
		case 'CLAIM_PENDING_FILL':
			return {
				ok: true,
				claimedFill: await withToken((token) =>
					background().api.claimPendingFill(token, message.purchaseId)
				)
			};
		case 'CLEAR_PENDING_FILL':
			await withToken((token) => background().api.clearPendingFill(token, message.purchaseId));
			return { ok: true, message: 'Cancelled.' };
		case 'LIST_READY':
			return {
				ok: true,
				purchases: await withToken((token) => background().api.readyPurchases(token))
			};
		case 'PREPARE_FILL_RUN':
			return { ok: true, purchase: await prepareFillRun(message.purchaseId) };
		case 'GET_FILL_PAYLOAD':
			return {
				ok: true,
				purchase:
					(await background().fillRunCache.purchase(message.purchaseId)) ??
					(await prepareFillRun(message.purchaseId))
			};
		case 'GET_FILL_DOCUMENT': {
			const dataUrl = await background().fillRunCache.document(message.documentId);
			if (dataUrl === null) throw new Error('This document isn’t loaded. Start the fill again.');
			return { ok: true, dataUrl };
		}
		case 'REVIEW_REACHED':
			await background().reviewOutbox.enqueue(message.purchaseId);
			await background().fillRunCache.clear();
			await flushReviews();
			return { ok: true, message: 'Review reached.' };
		case 'FILL_RUN_ENDED':
			await background().fillRunCache.clear();
			return { ok: true, message: 'Fill run ended.' };
		case 'START_FILL':
			return await fillActiveTab(message.purchaseId);
	}
}

async function handleExternalMessage(message: ExternalMessage): Promise<ExternalResponse> {
	if (message.type === 'CONNECT') {
		if (!/^[A-Za-z0-9_-]{43}$/.test(message.token) || message.sessionId === '') {
			return { ok: false, message: 'Invalid extension token.' };
		}
		const previous = await readConnection();
		await browser.storage.local.set({
			[connectionKey]: { token: message.token, sessionId: message.sessionId }
		});
		await browser.storage.local.remove(signedOutKey);
		if (previous !== null && previous.token !== message.token) {
			void background()
				.api.signOut(previous.token)
				.catch(() => undefined);
		}
		void flushReviews();
	}
	if (message.type === 'DISCONNECT') {
		await browser.storage.local.remove(connectionKey);
		await browser.storage.local.set({ [signedOutKey]: true });
		await background().fillRunCache.clear();
	}
	const connection = await readConnection();
	const stored = await browser.storage.local.get(signedOutKey);
	return {
		ok: true,
		connected: connection !== null,
		sessionId: connection?.sessionId ?? null,
		signedOut: stored[signedOutKey] === true
	};
}

async function readConnection(): Promise<Connection | null> {
	const stored = (await browser.storage.local.get(connectionKey))[connectionKey];
	if (typeof stored !== 'object' || stored === null) return null;
	const { token, sessionId } = stored as Record<string, unknown>;
	return typeof token === 'string' && typeof sessionId === 'string' ? { token, sessionId } : null;
}

async function requireToken() {
	const connection = await readConnection();
	if (connection === null) throw new ExtensionAuthError();
	return connection.token;
}

async function withToken<T>(run: (token: string) => Promise<T>) {
	const token = await requireToken();
	try {
		return await run(token);
	} catch (error) {
		if (error instanceof ExtensionAuthError) await forgetToken(token);
		throw error;
	}
}

async function forgetToken(token: string) {
	const connection = await readConnection();
	if (connection?.token === token) await browser.storage.local.remove(connectionKey);
}

async function signOut() {
	const connection = await readConnection();
	await browser.storage.local.remove(connectionKey);
	await browser.storage.local.set({ [signedOutKey]: true });
	await background().fillRunCache.clear();
	if (connection !== null)
		await background()
			.api.signOut(connection.token)
			.catch(() => undefined);
}

async function pendingFillState(): Promise<PendingFillState> {
	if ((await readConnection()) === null) return { signedIn: false };
	try {
		return {
			signedIn: true,
			pendingFill: await withToken((token) => background().api.pendingFill(token))
		};
	} catch (error) {
		if (error instanceof ExtensionAuthError) return { signedIn: false };
		throw error;
	}
}

async function prepareFillRun(purchaseId: string) {
	try {
		return await background().fillRunCache.prepare(purchaseId);
	} catch (error) {
		if (error instanceof ExtensionAuthError) {
			const connection = await readConnection();
			if (connection !== null) await forgetToken(connection.token);
		}
		throw error;
	}
}

async function flushReviews() {
	const nextAttemptAt = await background()
		.reviewOutbox.flush()
		.catch(() => null);
	if (nextAttemptAt === null) {
		await browser.alarms.clear(reviewAlarm);
		return;
	}
	await browser.alarms.create(reviewAlarm, { when: Math.max(nextAttemptAt, Date.now() + 1_000) });
}

async function fillActiveTab(purchaseId: string): Promise<FillResponse> {
	const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
	if (tab?.id === undefined) throw new Error('No active tab.');
	if (!isEngageFormUrl(tab.url)) throw new Error('Open the Engage purchase request form first.');
	const message: FillMessage = {
		type: 'START_FILL_RUN',
		purchase: await prepareFillRun(purchaseId)
	};
	try {
		return (await browser.tabs.sendMessage(tab.id, message)) as FillResponse;
	} catch {
		throw new Error('Refresh the Engage form and try again.');
	}
}

async function downloadDocument(document: Document) {
	if (!document.url) throw new Error(`Document unavailable: ${document.filename}.`);
	const response = await fetch(document.url, { signal: AbortSignal.timeout(documentTimeoutMs) });
	if (!response.ok) throw new Error(`Document unavailable: ${document.filename}.`);
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

function isWebAppSender(sender: Browser.runtime.MessageSender) {
	const origin = sender.origin ?? (sender.url ? new URL(sender.url).origin : null);
	return origin === new URL(readWebAppUrl()).origin;
}

function errorResponse(error: unknown) {
	return {
		ok: false as const,
		message: error instanceof Error ? error.message : String(error),
		...(error instanceof ExtensionAuthError ? { authRequired: true } : {})
	};
}

function logBackground(type: string, context: Record<string, unknown>) {
	console.info('[Engage Form][background]', type, context);
}

function summarizeResponse(response: RuntimeResponse) {
	if (!response.ok) return { ok: false, message: response.message };
	if ('purchase' in response) return { ok: true, purchasePresent: true };
	if ('dataUrl' in response) return { ok: true, dataUrlLength: response.dataUrl.length };
	if ('purchases' in response) return { ok: true, purchases: response.purchases.length };
	if ('claimedFill' in response) return { ok: true, claimed: response.claimedFill !== null };
	if ('pendingFillState' in response)
		return {
			ok: true,
			signedIn: response.pendingFillState.signedIn,
			pendingFill:
				response.pendingFillState.signedIn && response.pendingFillState.pendingFill !== null
		};
	if ('signedIn' in response) return { ok: true, signedIn: response.signedIn };
	if ('step' in response)
		return { ok: true, message: response.message, step: response.step, filled: response.filled };
	return { ok: true, message: response.message };
}
