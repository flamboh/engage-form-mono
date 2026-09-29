import { expect, test } from 'vitest';
import { ExtensionAuthError, ExtensionRequestError } from './extension-api';
import type { KeyValueStorage } from './fill-run-cache';
import { createReviewOutbox, reviewRetryDelay } from './review-outbox';

function memoryStorage(): KeyValueStorage {
	const data = new Map<string, unknown>();
	return {
		get: (keys) =>
			Promise.resolve(
				Object.fromEntries(keys.filter((key) => data.has(key)).map((key) => [key, data.get(key)]))
			),
		set(items) {
			for (const [key, value] of Object.entries(items)) data.set(key, structuredClone(value));
			return Promise.resolve();
		},
		remove(keys) {
			for (const key of keys) data.delete(key);
			return Promise.resolve();
		}
	};
}

test('retries review reached with backoff until the server answers', async () => {
	const storage = memoryStorage();
	let now = 0;
	let serverUp = false;
	const sent: string[] = [];
	const outbox = createReviewOutbox({
		storage,
		now: () => now,
		send(purchaseId) {
			if (!serverUp) return Promise.reject(new TypeError('Failed to fetch'));
			sent.push(purchaseId);
			return Promise.resolve();
		}
	});

	await outbox.enqueue('purchase_1');
	expect(await outbox.flush()).toBe(reviewRetryDelay(1));
	expect(await outbox.flush()).toBe(reviewRetryDelay(1));

	now = reviewRetryDelay(1);
	expect(await outbox.flush()).toBe(now + reviewRetryDelay(2));

	serverUp = true;
	const restarted = createReviewOutbox({
		storage,
		now: () => now,
		send: (id) => {
			sent.push(id);
			return Promise.resolve();
		}
	});
	expect(await restarted.flush()).toBe(now + reviewRetryDelay(2));
	now += reviewRetryDelay(2);
	expect(await restarted.flush()).toBeNull();
	expect(sent).toEqual(['purchase_1']);
	expect(await restarted.pending()).toEqual([]);
});

test('keeps retrying after auth errors but drops rejected reviews', async () => {
	const storage = memoryStorage();
	const outbox = createReviewOutbox({
		storage,
		now: () => 0,
		send: (purchaseId) =>
			Promise.reject(
				purchaseId === 'gone'
					? new ExtensionRequestError('Purchase request not found.')
					: new ExtensionAuthError()
			)
	});
	await outbox.enqueue('gone');
	await outbox.enqueue('needs_token');
	await outbox.flush();
	expect((await outbox.pending()).map((review) => review.purchaseId)).toEqual(['needs_token']);
});

test('caps the retry delay', () => {
	expect(reviewRetryDelay(1)).toBe(5_000);
	expect(reviewRetryDelay(2)).toBe(10_000);
	expect(reviewRetryDelay(50)).toBe(600_000);
});
