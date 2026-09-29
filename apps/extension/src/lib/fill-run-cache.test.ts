import { expect, test } from 'vitest';
import { samplePurchaseRequest, type PurchaseRequest } from '@engage-form/domain';
import type { FillAction } from '@engage-form/fill-engine';
import { createContentRunner, type FillRunState } from './content-runner';
import { createFillRunCache, fillRunMaxAgeMs, type KeyValueStorage } from './fill-run-cache';

function memoryStorage(
	maxValueLength = Infinity
): KeyValueStorage & { data: Map<string, unknown> } {
	const data = new Map<string, unknown>();
	return {
		data,
		get: (keys) =>
			Promise.resolve(
				Object.fromEntries(keys.filter((key) => data.has(key)).map((key) => [key, data.get(key)]))
			),
		set(items) {
			for (const [key, value] of Object.entries(items)) {
				if (typeof value === 'string' && value.length > maxValueLength) {
					return Promise.reject(new Error('QUOTA_BYTES quota exceeded'));
				}
			}
			for (const [key, value] of Object.entries(items)) data.set(key, structuredClone(value));
			return Promise.resolve();
		},
		remove(keys) {
			for (const key of keys) data.delete(key);
			return Promise.resolve();
		}
	};
}

const purchase: PurchaseRequest = {
	...samplePurchaseRequest,
	documents: samplePurchaseRequest.documents.map((document) => ({
		...document,
		url: `https://files.example/${document.id}?sig=abc`
	}))
};

function network() {
	const calls: string[] = [];
	let online = true;
	return {
		calls,
		goOffline: () => {
			online = false;
		},
		fetchPurchase(purchaseId: string) {
			calls.push(`purchase:${purchaseId}`);
			if (!online) return Promise.reject(new TypeError('Failed to fetch'));
			return Promise.resolve(structuredClone(purchase));
		},
		fetchDocument(document: { id: string }) {
			calls.push(`document:${document.id}`);
			if (!online) return Promise.reject(new TypeError('Failed to fetch'));
			return Promise.resolve(`data:image/png;base64,${document.id}`);
		}
	};
}

test('downloads the purchase and every document once when a run starts', async () => {
	const net = network();
	const session = memoryStorage();
	const cache = createFillRunCache({ stores: [session], ...net, now: () => 1_000 });

	const prepared = await cache.prepare(purchase.id);

	expect(net.calls).toEqual([
		`purchase:${purchase.id}`,
		...purchase.documents.map((document) => `document:${document.id}`)
	]);
	expect(prepared.documents.every((document) => document.url === null)).toBe(true);
	expect(session.data.size).toBe(1 + purchase.documents.length);
});

test('fills later pages from the cache with no network calls, even after a worker restart', async () => {
	const net = network();
	const session = memoryStorage();
	const now = () => 1_000;
	const first = createFillRunCache({ stores: [session], ...net, now });
	await first.prepare(purchase.id);
	net.goOffline();
	const callsAfterStart = net.calls.length;

	const restarted = createFillRunCache({ stores: [session], ...net, now });
	const headings = [
		'About You, Your Org, and Business Purpose',
		'Mandatory Claims',
		'Type of Purchase',
		'Personal Reimbursement Purchase Info',
		'Review Submission'
	];
	let page = 0;
	let state: FillRunState | null = {
		purchaseId: purchase.id,
		filled: 0,
		pageCount: 0,
		label: 'Amazon · $22.98'
	};
	const uploaded: string[] = [];
	const reviews: string[] = [];
	const runner = createContentRunner({
		pageHeading: () => headings[page],
		async applyFillPlan(actions: FillAction[]) {
			for (const action of actions) {
				if (action.type !== 'file') continue;
				for (const file of action.files) {
					const dataUrl = await restarted.document(file.id);
					if (dataUrl === null) throw new Error(`missing ${file.id}`);
					uploaded.push(file.id);
				}
			}
			return { filled: actions.length, missed: [], message: 'Filled current page.' };
		},
		clickNextStep() {
			page += 1;
			return true;
		},
		sendReviewReached(purchaseId) {
			reviews.push(purchaseId);
		},
		loadPurchaseRequest: (purchaseId) => restarted.purchase(purchaseId),
		loadFillRun: () => state,
		saveFillRun(next) {
			state = next;
		},
		clearFillRun() {
			state = null;
		}
	});

	let response = await runner.continueFillRun();
	while (response.ok && response.step !== 'review') response = await runner.continueFillRun();

	expect(response).toMatchObject({ ok: true, step: 'review' });
	expect(uploaded.length).toBeGreaterThan(0);
	expect(reviews).toEqual([purchase.id]);
	expect(net.calls.length).toBe(callsAfterStart);
});

test('spills documents that exceed the session quota to the next store', async () => {
	const net = network();
	const session = memoryStorage(10);
	const local = memoryStorage();
	const cache = createFillRunCache({ stores: [session, local], ...net, now: () => 1_000 });
	await cache.prepare(purchase.id);

	const restarted = createFillRunCache({ stores: [session, local], ...net, now: () => 1_000 });
	const document = purchase.documents[0];
	expect(await restarted.document(document.id)).toBe(`data:image/png;base64,${document.id}`);
	expect(local.data.size).toBe(purchase.documents.length);

	await restarted.clear();
	expect(session.data.size).toBe(0);
	expect(local.data.size).toBe(0);
});

test('forgets other purchases and stale runs', async () => {
	const net = network();
	const session = memoryStorage();
	let now = 1_000;
	const cache = createFillRunCache({ stores: [session], ...net, now: () => now });
	await cache.prepare(purchase.id);

	expect(await cache.purchase('other')).toBeNull();
	now += fillRunMaxAgeMs + 1;
	expect(await cache.purchase(purchase.id)).toBeNull();
	expect(session.data.size).toBe(0);
});
