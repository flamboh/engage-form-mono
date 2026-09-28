export const minTokenLifetimeMs = 15_000;

export function jwtExpiresAt(token: string): number | null {
	const [, payload] = token.split('.');
	if (payload === undefined || payload === '') return null;
	try {
		const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
		const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
		const claims: unknown = JSON.parse(atob(padded));
		if (typeof claims !== 'object' || claims === null || !('exp' in claims)) return null;
		return typeof claims.exp === 'number' && Number.isFinite(claims.exp)
			? claims.exp * 1_000
			: null;
	} catch {
		return null;
	}
}

export function isTokenUsable(token: string | null | undefined, now: number): token is string {
	if (typeof token !== 'string' || token === '') return false;
	const expiresAt = jwtExpiresAt(token);
	return expiresAt !== null && expiresAt - now >= minTokenLifetimeMs;
}

export function isConvexAuthError(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	return /unauthori[sz]ed|unauthenticated|auth token|invalidauth|oidc|jwt|token (is )?expired/i.test(
		message
	);
}
