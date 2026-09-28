import { expect, test } from 'vitest';
import {
	ownerKeyPrefix,
	ownsKey,
	signedFileUrl,
	signFileTicket,
	ticketFromUrl,
	uploadContentType,
	verifyFileTicket,
	type FileTicket
} from '../convex/fileSigning';

const secret = 'test-secret';
const now = 1_800_000_000_000;
const putTicket: FileTicket = {
	action: 'put',
	key: 'abc/11111111-2222-3333-4444-555555555555',
	expiresAt: now + 60_000,
	contentType: 'image/jpeg',
	maxSize: 15 * 1024 * 1024
};

test('signed tickets verify until they expire', async () => {
	const signature = await signFileTicket(secret, putTicket);
	expect(await verifyFileTicket(secret, putTicket, signature, now)).toBe(true);
	expect(await verifyFileTicket(secret, putTicket, signature, now + 60_001)).toBe(false);
});

test('tickets reject a wrong secret or any changed field', async () => {
	const signature = await signFileTicket(secret, putTicket);
	expect(await verifyFileTicket('other-secret', putTicket, signature, now)).toBe(false);
	for (const changed of [
		{ ...putTicket, action: 'get' as const },
		{ ...putTicket, action: 'delete' as const },
		{ ...putTicket, key: `${putTicket.key}x` },
		{ ...putTicket, expiresAt: putTicket.expiresAt + 1 },
		{ ...putTicket, contentType: 'text/html' },
		{ ...putTicket, maxSize: putTicket.maxSize! + 1 }
	])
		expect(await verifyFileTicket(secret, changed, signature, now)).toBe(false);
	expect(await verifyFileTicket(secret, putTicket, signature.slice(1), now)).toBe(false);
});

test('signed urls round trip through ticketFromUrl', async () => {
	const url = new URL(await signedFileUrl('https://forms.example', secret, putTicket));
	expect(url.pathname).toBe('/api/files/upload');
	const parsed = ticketFromUrl('put', url);
	expect(parsed?.ticket).toEqual(putTicket);
	expect(await verifyFileTicket(secret, parsed!.ticket, parsed!.signature, now)).toBe(true);
	expect(ticketFromUrl('get', url)?.ticket.action).toBe('get');
	const asGet = ticketFromUrl('get', url)!;
	expect(await verifyFileTicket(secret, asGet.ticket, asGet.signature, now)).toBe(false);
});

test('get and delete urls point at the object route', async () => {
	for (const action of ['get', 'delete'] as const) {
		const url = new URL(
			await signedFileUrl('https://forms.example', secret, {
				action,
				key: putTicket.key,
				expiresAt: putTicket.expiresAt
			})
		);
		expect(url.pathname).toBe('/api/files/object');
		expect(url.searchParams.has('ct')).toBe(false);
	}
});

test('ticketFromUrl requires key, expiry, and signature', () => {
	expect(ticketFromUrl('get', new URL('https://forms.example/api/files/object?key=a&exp=1'))).toBe(
		null
	);
});

test('owner key prefixes are stable, distinct, and gate key ownership', async () => {
	const alice = await ownerKeyPrefix('https://clerk.example|user_alice');
	const bob = await ownerKeyPrefix('https://clerk.example|user_bob');
	expect(alice).toMatch(/^[0-9a-f]{24}$/);
	expect(await ownerKeyPrefix('https://clerk.example|user_alice')).toBe(alice);
	expect(bob).not.toBe(alice);
	const key = `${alice}/${crypto.randomUUID()}`;
	expect(ownsKey(alice, key)).toBe(true);
	expect(ownsKey(bob, key)).toBe(false);
	expect(ownsKey(alice, `${alice}/../${bob}/${crypto.randomUUID()}`)).toBe(false);
	expect(ownsKey(alice, `${alice}/${crypto.randomUUID()}/extra`)).toBe(false);
	expect(ownsKey(alice, `${alice}x/${crypto.randomUUID()}`)).toBe(false);
	expect(ownsKey(alice, alice)).toBe(false);
});

test('ticket fields cannot be shifted across boundaries', async () => {
	const signature = await signFileTicket(secret, {
		action: 'get',
		key: 'abc',
		expiresAt: now,
		contentType: 'image/png\n1'
	});
	expect(
		await verifyFileTicket(
			secret,
			{ action: 'get', key: 'abc', expiresAt: now, contentType: 'image/png', maxSize: 1 },
			signature,
			now
		)
	).toBe(false);
	const withoutOptional = await signFileTicket(secret, { action: 'get', key: 'k', expiresAt: now });
	expect(
		await verifyFileTicket(
			secret,
			{ action: 'get', key: 'k', expiresAt: now, contentType: '' },
			withoutOptional,
			now
		)
	).toBe(false);
});

test('upload content types are normalized and whitelisted', () => {
	expect(uploadContentType('image/JPEG')).toBe('image/jpeg');
	expect(uploadContentType(' application/pdf ')).toBe('application/pdf');
	expect(uploadContentType('image/heic')).toBe('image/heic');
	for (const bad of [
		'text/html',
		'image/svg+xml',
		'application/octet-stream',
		'image/png\nx',
		'image/png; charset=utf-8',
		''
	])
		expect(() => uploadContentType(bad)).toThrow();
});
