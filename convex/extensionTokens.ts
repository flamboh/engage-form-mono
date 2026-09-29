const day = 24 * 60 * 60 * 1000;

export const extensionSessionTtlMs = 30 * day;
export const extensionSessionTouchIntervalMs = 60 * 60 * 1000;
export const extensionId = 'obfjadbmonppinfhbcciiemmcbaioocn';
export const extensionOrigin = `chrome-extension://${extensionId}`;

export type ExtensionSessionState = {
	expiresAt: number;
	revokedAt: number | null;
	lastUsedAt: number;
};

export type ExtensionSessionStatus = 'active' | 'expired' | 'revoked';

export function generateExtensionToken() {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return base64Url(bytes);
}

export async function hashExtensionToken(token: string) {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function isWellFormedExtensionToken(token: string) {
	return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function bearerToken(header: string | null) {
	const match = /^Bearer\s+(\S+)$/i.exec(header?.trim() ?? '');
	if (match === null) return null;
	return isWellFormedExtensionToken(match[1]) ? match[1] : null;
}

export function extensionSessionStatus(
	session: ExtensionSessionState,
	now: number
): ExtensionSessionStatus {
	if (session.revokedAt !== null) return 'revoked';
	if (session.expiresAt <= now) return 'expired';
	return 'active';
}

export function shouldTouchExtensionSession(session: ExtensionSessionState, now: number) {
	return now - session.lastUsedAt >= extensionSessionTouchIntervalMs;
}

export function extensionSessionExpiry(now: number) {
	return now + extensionSessionTtlMs;
}

function base64Url(bytes: Uint8Array) {
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}
