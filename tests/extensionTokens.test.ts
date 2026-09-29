import { expect, test } from 'vitest';
import {
	bearerToken,
	extensionSessionExpiry,
	extensionSessionStatus,
	extensionSessionTtlMs,
	generateExtensionToken,
	hashExtensionToken,
	isWellFormedExtensionToken,
	shouldTouchExtensionSession
} from '../convex/extensionTokens';

const now = 1_800_000_000_000;
const hour = 60 * 60 * 1000;

function session(overrides: Partial<Parameters<typeof extensionSessionStatus>[0]> = {}) {
	return { expiresAt: now + hour, revokedAt: null, lastUsedAt: now - hour / 2, ...overrides };
}

test('generates 32 random bytes as base64url', () => {
	const token = generateExtensionToken();
	expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
	expect(isWellFormedExtensionToken(token)).toBe(true);
	expect(generateExtensionToken()).not.toBe(token);
});

test('hashes tokens with SHA-256 hex', async () => {
	expect(await hashExtensionToken('abc')).toBe(
		'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
	);
});

test('a wrong token never hashes to the stored hash', async () => {
	const token = generateExtensionToken();
	const stored = await hashExtensionToken(token);
	expect(await hashExtensionToken(token)).toBe(stored);
	expect(await hashExtensionToken(generateExtensionToken())).not.toBe(stored);
	const flipped = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`;
	expect(await hashExtensionToken(flipped)).not.toBe(stored);
});

test('reads only well-formed bearer tokens', () => {
	const token = generateExtensionToken();
	expect(bearerToken(`Bearer ${token}`)).toBe(token);
	expect(bearerToken(`bearer  ${token}`)).toBe(token);
	expect(bearerToken(token)).toBeNull();
	expect(bearerToken('Bearer short')).toBeNull();
	expect(bearerToken(`Basic ${token}`)).toBeNull();
	expect(bearerToken(null)).toBeNull();
});

test('reports active, expired, and revoked sessions', () => {
	expect(extensionSessionStatus(session(), now)).toBe('active');
	expect(extensionSessionStatus(session({ expiresAt: now }), now)).toBe('expired');
	expect(extensionSessionStatus(session({ expiresAt: now - 1 }), now)).toBe('expired');
	expect(extensionSessionStatus(session({ revokedAt: now - 1 }), now)).toBe('revoked');
	expect(extensionSessionStatus(session({ revokedAt: now - 1, expiresAt: now - 1 }), now)).toBe(
		'revoked'
	);
});

test('slides expiry about 30 days forward at most once an hour', () => {
	expect(extensionSessionExpiry(now)).toBe(now + extensionSessionTtlMs);
	expect(extensionSessionTtlMs).toBe(30 * 24 * hour);
	expect(shouldTouchExtensionSession(session(), now)).toBe(false);
	expect(shouldTouchExtensionSession(session({ lastUsedAt: now - hour }), now)).toBe(true);
});
