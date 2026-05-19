import { createClerkClient } from '@clerk/chrome-extension/client';
import { Effect } from 'effect';
import { browser } from 'wxt/browser';
import { readClerkPublishableKey, readClerkSyncHost } from '../lib/env';
import { type RuntimeMessage, type RuntimeResponse, runtimeError } from '../lib/messages';

let clerk: ReturnType<typeof createSyncedClerk> | null = null;
const clerkTokenTimeoutMs = 4_000;

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
			return { ok: true, message: 'Signed out.' } as const;
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
	return { ok: true, message: response.message };
}
