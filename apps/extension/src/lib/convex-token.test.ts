import { expect, test } from 'vitest';
import { isConvexAuthError, isTokenUsable, jwtExpiresAt } from './convex-token';

const now = 1_800_000_000_000;

function jwt(claims: Record<string, unknown>) {
	const encode = (value: unknown) =>
		btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
	return `${encode({ alg: 'RS256' })}.${encode(claims)}.signature`;
}

test('reads the JWT expiry in milliseconds', () => {
	expect(jwtExpiresAt(jwt({ exp: 1_800_000_060 }))).toBe(1_800_000_060_000);
});

test('returns null for tokens without a readable expiry', () => {
	expect(jwtExpiresAt('not-a-jwt')).toBeNull();
	expect(jwtExpiresAt('a.%%%.c')).toBeNull();
	expect(jwtExpiresAt(jwt({ sub: 'user' }))).toBeNull();
	expect(jwtExpiresAt(jwt({ exp: '1800000060' }))).toBeNull();
});

test('accepts tokens with at least fifteen seconds left', () => {
	expect(isTokenUsable(jwt({ exp: now / 1_000 + 60 }), now)).toBe(true);
	expect(isTokenUsable(jwt({ exp: now / 1_000 + 15 }), now)).toBe(true);
});

test('rejects expired, nearly expired, and unreadable tokens', () => {
	expect(isTokenUsable(jwt({ exp: now / 1_000 + 14 }), now)).toBe(false);
	expect(isTokenUsable(jwt({ exp: now / 1_000 - 30 }), now)).toBe(false);
	expect(isTokenUsable('not-a-jwt', now)).toBe(false);
	expect(isTokenUsable(null, now)).toBe(false);
});

test('recognizes Convex auth failures', () => {
	expect(isConvexAuthError(new Error('Uncaught Error: Unauthorized'))).toBe(true);
	expect(isConvexAuthError(new Error('Could not verify OIDC token claim'))).toBe(true);
	expect(isConvexAuthError(new Error('Purchase request is not ready.'))).toBe(false);
});
