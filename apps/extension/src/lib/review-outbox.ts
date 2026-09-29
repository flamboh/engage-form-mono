import { ExtensionRequestError } from './extension-api';
import type { KeyValueStorage } from './fill-run-cache';

export type PendingReview = {
	purchaseId: string;
	attempts: number;
	nextAttemptAt: number;
};

type ReviewOutboxDeps = {
	storage: KeyValueStorage;
	send(purchaseId: string): Promise<void>;
	now(): number;
};

const outboxKey = 'pendingReviews';
const firstRetryMs = 5_000;
const maxRetryMs = 10 * 60_000;

export function reviewRetryDelay(attempts: number) {
	return Math.min(maxRetryMs, firstRetryMs * 2 ** Math.max(0, attempts - 1));
}

export function createReviewOutbox(deps: ReviewOutboxDeps) {
	let queue: Promise<unknown> = Promise.resolve();

	function serialized<T>(run: () => Promise<T>) {
		const next = queue.then(run, run);
		queue = next.catch(() => undefined);
		return next;
	}

	async function read() {
		const value = (await deps.storage.get([outboxKey]))[outboxKey];
		return Array.isArray(value) ? (value as PendingReview[]) : [];
	}

	function enqueue(purchaseId: string) {
		return serialized(async () => {
			const reviews = (await read()).filter((review) => review.purchaseId !== purchaseId);
			await deps.storage.set({
				[outboxKey]: [...reviews, { purchaseId, attempts: 0, nextAttemptAt: deps.now() }]
			});
		});
	}

	function flush() {
		return serialized(async () => {
			const remaining: PendingReview[] = [];
			for (const review of await read()) {
				if (review.nextAttemptAt > deps.now()) {
					remaining.push(review);
					continue;
				}
				try {
					await deps.send(review.purchaseId);
				} catch (error) {
					if (error instanceof ExtensionRequestError) continue;
					const attempts = review.attempts + 1;
					remaining.push({
						purchaseId: review.purchaseId,
						attempts,
						nextAttemptAt: deps.now() + reviewRetryDelay(attempts)
					});
				}
			}
			await deps.storage.set({ [outboxKey]: remaining });
			return remaining.length === 0
				? null
				: Math.min(...remaining.map((review) => review.nextAttemptAt));
		});
	}

	return { enqueue, flush, pending: () => serialized(read) };
}

export type ReviewOutbox = ReturnType<typeof createReviewOutbox>;
