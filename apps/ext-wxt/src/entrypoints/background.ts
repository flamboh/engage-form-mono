import { createClerkClient } from '@clerk/chrome-extension/client';
import { Effect } from 'effect';
import { browser } from 'wxt/browser';
import { readClerkPublishableKey, readClerkSyncHost } from '../lib/env';
import { type RuntimeMessage, type RuntimeResponse, runtimeError } from '../lib/messages';

let clerk: ReturnType<typeof createSyncedClerk> | null = null;

export default defineBackground(() => {
	browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
		void Effect.runPromise(handleRuntimeMessage(message as RuntimeMessage))
			.then(sendResponse)
			.catch((error: unknown) => sendResponse(runtimeError(error)));
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
			return { ok: true, message: 'Signed out.' } as const;
		});
	}

	return Effect.succeed({ ok: false, message: 'Unknown extension operation.' });
}

function getConvexTokenEffect() {
	return Effect.gen(function* () {
		const client = yield* getClerkEffect();
		const token = yield* Effect.tryPromise({
			try: () => client.session?.getToken({ template: 'convex' }) ?? Promise.resolve(null),
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

function toError(error: unknown) {
	return error instanceof Error ? error : new Error(String(error));
}
