import { createClerkClient } from '@clerk/chrome-extension/client';
import type { PurchaseRequest } from '@engage-form/domain';
import { ConvexHttpClient } from 'convex/browser';
import { Effect } from 'effect';
import { browser } from 'wxt/browser';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { readClerkPublishableKey, readClerkSyncHost, readConvexUrl } from '../lib/env';
import {
	type FillMessage,
	type FillResponse,
	type RuntimeMessage,
	type RuntimeResponse,
	runtimeError
} from '../lib/messages';

let clerk: ReturnType<typeof createSyncedClerk> | null = null;
const clerkTokenTimeoutMs = 4_000;
const documentDataUrls = new Map<string, string>();
let activePurchaseId: string | null = null;
let activeConvexToken: string | null = null;

export default defineBackground(() => {
	browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
		const runtimeMessage = message as RuntimeMessage;
		logBackground('message received', { type: runtimeMessage.type });
		void Effect.runPromise(handleRuntimeMessage(message as RuntimeMessage))
			.then((response) => {
				logBackground('message response', summarizeResponse(response));
				sendResponse(response);
			})
			.catch((error: unknown) => {
				const response = runtimeError(error);
				logBackground('message error', {
					type: runtimeMessage.type,
					...summarizeResponse(response)
				});
				sendResponse(response);
			});
		return true;
	});
});

function handleRuntimeMessage(message: RuntimeMessage): Effect.Effect<RuntimeResponse, Error> {
	if (message.type === 'AUTH_STATE') {
		return Effect.gen(function* () {
			const client = yield* refreshClerkEffect();
			return {
				ok: true,
				signedIn: client.session !== null,
				email: client.user?.primaryEmailAddress?.emailAddress ?? null
			} as const;
		});
	}

	if (message.type === 'GET_CONVEX_TOKEN') {
		return Effect.gen(function* () {
			const token = yield* getConvexTokenEffect();
			return { ok: true, token } as const;
		});
	}

	if (message.type === 'SIGN_OUT') {
		return Effect.gen(function* () {
			const client = yield* getClerkEffect();
			yield* Effect.tryPromise({
				try: () => client.signOut(),
				catch: toError
			});
			yield* refreshClerkEffect();
			clearActiveFillRun();
			return { ok: true, message: 'Signed out.' } as const;
		});
	}

	if (message.type === 'FILL_RUN_ENDED') {
		clearActiveFillRun();
		return Effect.succeed({ ok: true, message: 'Fill run ended.' });
	}

	if (message.type === 'GET_FILL_PAYLOAD') {
		return Effect.tryPromise({
			try: async () => ({
				ok: true,
				purchase: await getPreparedPurchase(message.purchaseId)
			}),
			catch: toError
		});
	}

	if (message.type === 'REVIEW_REACHED') {
		return Effect.tryPromise({
			try: async () => {
				const convex = await authedConvex();
				await convex.mutation(api.authed.extension.markReviewReached, {
					id: message.purchaseId as Id<'purchaseRequests'>
				});
				clearActiveFillRun();
				return { ok: true, message: 'Marked review reached.' } as const;
			},
			catch: toError
		});
	}

	if (message.type === 'START_FILL') {
		return Effect.tryPromise({
			try: () => fillActiveTab(message.purchaseId, message.token),
			catch: toError
		});
	}

	return Effect.succeed({ ok: false, message: 'Unknown extension operation.' });
}

function getConvexTokenEffect() {
	return Effect.gen(function* () {
		const client = yield* refreshClerkEffect();
		if (client.session === null) return null;

		const token = yield* Effect.tryPromise({
			try: () =>
				withTimeout(
					client.session!.getToken({ template: 'convex' }),
					`Clerk Convex token did not respond within ${clerkTokenTimeoutMs / 1_000}s.`,
					clerkTokenTimeoutMs
				),
			catch: toError
		});
		return token;
	});
}

function createSyncedClerk() {
	return createClerkClient({
		publishableKey: readClerkPublishableKey(),
		syncHost: readClerkSyncHost(),
		background: true
	});
}

function getClerk() {
	clerk ??= createSyncedClerk().catch((error: unknown) => {
		clerk = null;
		throw error;
	});
	return clerk;
}

function refreshClerk() {
	clerk = null;
	return getClerk();
}

function getClerkEffect() {
	return Effect.tryPromise({
		try: getClerk,
		catch: toError
	});
}

function refreshClerkEffect() {
	return Effect.tryPromise({
		try: refreshClerk,
		catch: toError
	});
}

async function fillActiveTab(purchaseId: string, token: string): Promise<FillResponse> {
	const purchase = await getPreparedPurchase(purchaseId, token);
	const tab = await currentEngageTab();
	const message: FillMessage = {
		type: 'START_FILL_RUN',
		purchase
	};
	return await sendFillMessage(tab.id, message);
}

async function currentEngageTab() {
	const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
	if (tab?.id === undefined) throw new Error('No active tab.');
	if (!isEngageFormUrl(tab.url)) throw new Error('Open the Engage purchase request form first.');
	return { id: tab.id };
}

function isEngageFormUrl(url: string | undefined) {
	return url?.startsWith('https://uoregon.campuslabs.com/engage/submitter/form/') === true;
}

async function sendFillMessage(tabId: number, message: FillMessage): Promise<FillResponse> {
	try {
		return (await browser.tabs.sendMessage(tabId, message)) as FillResponse;
	} catch {
		throw new Error('Refresh the Engage form and try again.');
	}
}

async function authedConvex(token?: string) {
	const convexToken =
		token ?? activeConvexToken ?? (await Effect.runPromise(getConvexTokenEffect()));
	if (convexToken === null) throw new Error('Signed in session missing Convex token.');
	const convex = new ConvexHttpClient(readConvexUrl());
	convex.setAuth(convexToken);
	return convex;
}

async function getPreparedPurchase(purchaseId: string, token?: string): Promise<PurchaseRequest> {
	if (activePurchaseId !== purchaseId) {
		clearActiveFillRun();
		activePurchaseId = purchaseId;
	}
	activeConvexToken = token ?? activeConvexToken;

	const convex = await authedConvex(token);
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
	activeConvexToken = null;
	documentDataUrls.clear();
}

function toError(error: unknown) {
	return error instanceof Error ? error : new Error(String(error));
}

function withTimeout<T>(promise: Promise<T>, message: string, timeoutMs: number) {
	return new Promise<T>((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
		promise.then(resolve, reject).finally(() => clearTimeout(timeout));
	});
}

function logBackground(message: string, context: Record<string, unknown> = {}) {
	console.info('[Engage Form][background]', message, context);
}

function summarizeResponse(response: RuntimeResponse) {
	if (!response.ok) return { ok: false, message: response.message };
	if ('token' in response) return { ok: true, tokenPresent: response.token !== null };
	if ('signedIn' in response)
		return { ok: true, signedIn: response.signedIn, emailPresent: response.email !== null };
	if ('purchase' in response) return { ok: true, purchasePresent: true };
	if ('step' in response)
		return { ok: true, message: response.message, step: response.step, filled: response.filled };
	return { ok: true, message: response.message };
}
