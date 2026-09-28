import { createClerkClient } from '@clerk/chrome-extension/client';
import type { PurchaseRequest } from '@engage-form/domain';
import { isEngageFormUrl } from '@engage-form/fill-engine';
import { ConvexHttpClient } from 'convex/browser';
import { Effect } from 'effect';
import { browser } from 'wxt/browser';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import {
	readClerkPublishableKey,
	readClerkSyncHost,
	readConvexUrl,
	readWebAppUrl
} from '../lib/env';
import {
	type FillMessage,
	type FillResponse,
	type RuntimeMessage,
	type RuntimeResponse,
	runtimeError
} from '../lib/messages';
import { isConvexAuthError, isTokenUsable } from '../lib/convex-token';
import type { PendingFillState } from '../lib/pending-fill';
import { withTimeout } from '../lib/timeout';
import { readWebAppConvexToken } from '../lib/web-app-token';

let clerk: ReturnType<typeof createSyncedClerk> | null = null;
const clerkTokenTimeoutMs = 4_000;
const signedOutKey = 'engageFormSignedOut';
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
			if (yield* Effect.promise(isSignedOut)) {
				return { ok: true, signedIn: false, email: null } as const;
			}
			const client = yield* refreshClerkEffect();
			const signedIn =
				client.session !== null ||
				(yield* Effect.promise(() => readWebAppConvexToken(readWebAppUrl()))) !== null;
			return {
				ok: true,
				signedIn,
				email: client.user?.primaryEmailAddress?.emailAddress ?? null
			} as const;
		});
	}

	if (message.type === 'GET_CONVEX_TOKEN') {
		return Effect.tryPromise({
			try: async () =>
				({ ok: true, token: await getConvexToken(message.forceRefresh === true) }) as const,
			catch: toError
		});
	}

	if (message.type === 'SIGN_IN') {
		return Effect.tryPromise({
			try: async () => {
				await browser.storage.local.remove(signedOutKey);
				await browser.tabs.create({ url: `${readWebAppUrl()}/app` });
				return { ok: true, message: 'Opening sign in.' } as const;
			},
			catch: toError
		});
	}

	if (message.type === 'SIGN_OUT') {
		return Effect.gen(function* () {
			clearActiveFillRun();
			yield* Effect.promise(() => browser.storage.local.set({ [signedOutKey]: true }));
			const client = yield* getClerkEffect();
			yield* Effect.tryPromise({
				try: () => client.signOut(),
				catch: toError
			});
			yield* refreshClerkEffect();
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
				await withConvex((convex) =>
					convex.mutation(api.authed.extension.markReviewReached, {
						id: message.purchaseId as Id<'purchaseRequests'>
					})
				);
				clearActiveFillRun();
				return { ok: true, message: 'Marked review reached.' } as const;
			},
			catch: toError
		});
	}

	if (message.type === 'GET_PENDING_FILL') {
		return Effect.tryPromise({
			try: async () => ({ ok: true, pendingFillState: await getPendingFillState() }) as const,
			catch: toError
		});
	}

	if (message.type === 'CLAIM_PENDING_FILL') {
		return Effect.tryPromise({
			try: async () => ({
				ok: true as const,
				claimedFill: await withConvex((convex) =>
					convex.mutation(api.authed.extension.claimPendingFill, {
						purchaseRequestId: message.purchaseId as Id<'purchaseRequests'>
					})
				)
			}),
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

async function isSignedOut() {
	const stored = await browser.storage.local.get(signedOutKey);
	return stored[signedOutKey] === true;
}

async function getConvexToken(preferClerk = false) {
	if (await isSignedOut()) return null;
	if (preferClerk) {
		const clerkToken = await getClerkConvexToken(true).catch(() => null);
		if (clerkToken !== null) return clerkToken;
	}
	const webToken = await readWebAppConvexToken(readWebAppUrl());
	if (webToken !== null) return webToken;
	return await getClerkConvexToken(false);
}

async function getClerkConvexToken(skipCache: boolean) {
	if (await isSignedOut()) return null;
	const client = await refreshClerk();
	const session = client.session;
	if (!session) return null;
	const token = await withTimeout(
		session.getToken({ template: 'convex', skipCache }),
		`Clerk Convex token did not respond within ${clerkTokenTimeoutMs / 1_000}s.`,
		clerkTokenTimeoutMs
	);
	return isTokenUsable(token, Date.now()) ? token : null;
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

async function sendFillMessage(tabId: number, message: FillMessage): Promise<FillResponse> {
	try {
		return (await browser.tabs.sendMessage(tabId, message)) as FillResponse;
	} catch {
		throw new Error('Refresh the Engage form and try again.');
	}
}

async function withConvex<T>(
	run: (convex: ConvexHttpClient) => Promise<T>,
	token?: string
): Promise<T> {
	const now = Date.now();
	const firstToken =
		(isTokenUsable(token, now) ? token : null) ??
		(isTokenUsable(activeConvexToken, now) ? activeConvexToken : null) ??
		(await getConvexToken());
	if (firstToken === null) throw new Error('Sign in to Engage Form first.');
	try {
		return await run(convexClient(firstToken));
	} catch (error) {
		if (!isConvexAuthError(error)) throw error;
		const retryToken = await getClerkConvexToken(true).catch(() => null);
		if (retryToken === null || retryToken === firstToken) throw error;
		if (activeConvexToken !== null) activeConvexToken = retryToken;
		return await run(convexClient(retryToken));
	}
}

function convexClient(token: string) {
	const convex = new ConvexHttpClient(readConvexUrl());
	convex.setAuth(token);
	return convex;
}

async function getPendingFillState(): Promise<PendingFillState> {
	const token = await getConvexToken().catch(() => null);
	if (token === null) return { signedIn: false };

	try {
		const pendingFill = await withConvex(
			(convex) => convex.query(api.authed.extension.getPendingFill, {}),
			token
		);
		return { signedIn: true, pendingFill };
	} catch (error) {
		if (isConvexAuthError(error)) return { signedIn: false };
		throw error;
	}
}

async function getPreparedPurchase(purchaseId: string, token?: string): Promise<PurchaseRequest> {
	if (activePurchaseId !== purchaseId) {
		clearActiveFillRun();
		activePurchaseId = purchaseId;
	}
	if (isTokenUsable(token, Date.now())) activeConvexToken = token;

	const purchase = (await withConvex(
		(convex) =>
			convex.query(api.authed.extension.getReadyPurchaseForFill, {
				id: purchaseId as Id<'purchaseRequests'>
			}),
		token
	)) as unknown as PurchaseRequest;

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

function logBackground(message: string, context: Record<string, unknown> = {}) {
	console.info('[Engage Form][background]', message, context);
}

function summarizeResponse(response: RuntimeResponse) {
	if (!response.ok) return { ok: false, message: response.message };
	if ('token' in response) return { ok: true, tokenPresent: response.token !== null };
	if ('signedIn' in response)
		return { ok: true, signedIn: response.signedIn, emailPresent: response.email !== null };
	if ('purchase' in response) return { ok: true, purchasePresent: true };
	if ('claimedFill' in response) return { ok: true, claimed: response.claimedFill !== null };
	if ('pendingFillState' in response)
		return {
			ok: true,
			signedIn: response.pendingFillState.signedIn,
			pendingFill:
				response.pendingFillState.signedIn && response.pendingFillState.pendingFill !== null
		};
	if ('step' in response)
		return { ok: true, message: response.message, step: response.step, filled: response.filled };
	return { ok: true, message: response.message };
}
