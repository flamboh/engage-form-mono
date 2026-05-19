export type WebAppTokenStorageResponse =
	| { ok: true; token: string | null }
	| { ok: false; message: string };

export function readConvexTokenFromWebAppStorage(maxAgeMs: number): WebAppTokenStorageResponse {
	try {
		const raw = localStorage.getItem('engage-form:convex-token');
		if (!raw) return { ok: false, message: 'Web app Convex token is not cached yet.' };
		const parsed = JSON.parse(raw) as {
			token?: unknown;
			updatedAt?: unknown;
		};
		if (typeof parsed.token !== 'string' || typeof parsed.updatedAt !== 'number') {
			return { ok: false, message: 'Cached web app Convex token is invalid.' };
		}
		if (Date.now() - parsed.updatedAt > maxAgeMs) {
			return { ok: false, message: 'Cached web app Convex token is stale.' };
		}
		return { ok: true, token: parsed.token };
	} catch (error) {
		return {
			ok: false,
			message: error instanceof Error ? error.message : String(error)
		};
	}
}
