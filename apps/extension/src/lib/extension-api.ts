import type { PurchaseRequest } from '@engage-form/domain';
import type { ReadyPurchaseRequest } from './messages';
import type { PendingFill } from './pending-fill';

const requestTimeoutMs = 15_000;

export class ExtensionAuthError extends Error {
	constructor() {
		super('Connect the extension to Engage Form.');
		this.name = 'ExtensionAuthError';
	}
}

export class ExtensionRequestError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ExtensionRequestError';
	}
}

type Fetch = typeof fetch;

export function createExtensionApi(siteUrl: string, fetcher: Fetch = fetch) {
	async function call<T>(
		token: string,
		method: 'GET' | 'POST',
		path: string,
		body?: unknown
	): Promise<T> {
		const response = await fetcher(`${siteUrl}${path}`, {
			method,
			headers: {
				Authorization: `Bearer ${token}`,
				...(body === undefined ? {} : { 'Content-Type': 'application/json' })
			},
			body: body === undefined ? undefined : JSON.stringify(body),
			signal: AbortSignal.timeout(requestTimeoutMs)
		});
		if (response.status === 401) throw new ExtensionAuthError();
		const json: unknown = await response.json().catch(() => null);
		if (!response.ok) {
			const message =
				isRecord(json) && typeof json.error === 'string'
					? json.error
					: `Engage Form returned ${response.status}.`;
			if (response.status >= 500) throw new Error(message);
			throw new ExtensionRequestError(message);
		}
		return (isRecord(json) ? json.value : null) as T;
	}

	return {
		pendingFill: (token: string) =>
			call<PendingFill | null>(token, 'GET', '/extension/pending-fill'),
		claimPendingFill: (token: string, purchaseRequestId: string) =>
			call<PendingFill | null>(token, 'POST', '/extension/pending-fill/claim', {
				purchaseRequestId
			}),
		clearPendingFill: (token: string, purchaseRequestId: string) =>
			call<null>(token, 'POST', '/extension/pending-fill/clear', { purchaseRequestId }),
		readyPurchases: (token: string) =>
			call<ReadyPurchaseRequest[]>(token, 'GET', '/extension/ready'),
		purchase: (token: string, purchaseRequestId: string) =>
			call<PurchaseRequest>(
				token,
				'GET',
				`/extension/purchase?id=${encodeURIComponent(purchaseRequestId)}`
			),
		reviewReached: (token: string, purchaseRequestId: string) =>
			call<null>(token, 'POST', '/extension/review-reached', { purchaseRequestId }),
		signOut: (token: string) => call<null>(token, 'POST', '/extension/sign-out')
	};
}

export type ExtensionApi = ReturnType<typeof createExtensionApi>;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
