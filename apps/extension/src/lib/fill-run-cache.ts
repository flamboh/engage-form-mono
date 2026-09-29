import type { Document, PurchaseRequest } from '@engage-form/domain';

export type KeyValueStorage = {
	get(keys: string[]): Promise<Record<string, unknown>>;
	set(items: Record<string, unknown>): Promise<void>;
	remove(keys: string[]): Promise<void>;
};

type StoredRun = {
	purchaseId: string;
	purchase: PurchaseRequest;
	documentIds: string[];
	preparedAt: number;
};

type FillRunCacheDeps = {
	stores: KeyValueStorage[];
	fetchPurchase(purchaseId: string): Promise<PurchaseRequest>;
	fetchDocument(document: Document): Promise<string>;
	now(): number;
};

export const fillRunMaxAgeMs = 6 * 60 * 60 * 1000;
const runKey = 'fillRun';

export function createFillRunCache(deps: FillRunCacheDeps) {
	let run: StoredRun | null = null;
	const documents = new Map<string, string>();

	async function prepare(purchaseId: string) {
		await clear();
		const fetched = await deps.fetchPurchase(purchaseId);
		const downloaded = await Promise.all(
			fetched.documents.map(async (document) => ({
				id: document.id,
				dataUrl: await deps.fetchDocument(document)
			}))
		);
		const purchase = {
			...fetched,
			documents: fetched.documents.map((document) => ({ ...document, url: null }))
		};
		const stored: StoredRun = {
			purchaseId,
			purchase,
			documentIds: downloaded.map((document) => document.id),
			preparedAt: deps.now()
		};
		run = stored;
		for (const document of downloaded) documents.set(document.id, document.dataUrl);
		await deps.stores[0].set({ [runKey]: stored });
		for (const document of downloaded) await persistDocument(document.id, document.dataUrl);
		return purchase;
	}

	async function purchase(purchaseId: string) {
		const current = await currentRun();
		return current?.purchaseId === purchaseId ? current.purchase : null;
	}

	async function document(documentId: string) {
		const cached = documents.get(documentId);
		if (cached !== undefined) return cached;
		const current = await currentRun();
		if (current === null || !current.documentIds.includes(documentId)) return null;
		for (const store of deps.stores) {
			const value = (await store.get([documentKey(documentId)]))[documentKey(documentId)];
			if (typeof value === 'string') {
				documents.set(documentId, value);
				return value;
			}
		}
		return null;
	}

	async function clear() {
		const current = run ?? (await readRun());
		run = null;
		documents.clear();
		const keys = [runKey, ...(current?.documentIds ?? []).map(documentKey)];
		await Promise.all(deps.stores.map((store) => store.remove(keys)));
	}

	async function currentRun() {
		if (run !== null && !isStale(run)) return run;
		const stored = await readRun();
		if (stored === null) return null;
		if (isStale(stored)) {
			await clear();
			return null;
		}
		run = stored;
		return run;
	}

	async function readRun() {
		const value = (await deps.stores[0].get([runKey]))[runKey];
		return isStoredRun(value) ? value : null;
	}

	async function persistDocument(documentId: string, dataUrl: string) {
		for (const store of deps.stores) {
			try {
				await store.set({ [documentKey(documentId)]: dataUrl });
				return;
			} catch {
				continue;
			}
		}
	}

	function isStale(value: StoredRun) {
		return deps.now() - value.preparedAt > fillRunMaxAgeMs;
	}

	return { prepare, purchase, document, clear, currentRun };
}

export type FillRunCache = ReturnType<typeof createFillRunCache>;

function documentKey(documentId: string) {
	return `fillRunDocument:${documentId}`;
}

function isStoredRun(value: unknown): value is StoredRun {
	if (typeof value !== 'object' || value === null) return false;
	const record = value as Record<string, unknown>;
	return (
		typeof record.purchaseId === 'string' &&
		typeof record.preparedAt === 'number' &&
		Array.isArray(record.documentIds) &&
		typeof record.purchase === 'object' &&
		record.purchase !== null
	);
}
