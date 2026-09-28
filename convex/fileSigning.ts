export type FileAction = 'put' | 'get' | 'delete';

export type FileTicket = {
	action: FileAction;
	key: string;
	expiresAt: number;
	contentType?: string;
	maxSize?: number;
};

const encoder = new TextEncoder();

function canonical(ticket: FileTicket) {
	return [
		ticket.action,
		ticket.key,
		String(ticket.expiresAt),
		ticket.contentType ?? '',
		ticket.maxSize === undefined ? '' : String(ticket.maxSize)
	].join('\n');
}

async function hmac(secret: string, message: string) {
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
	return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function signFileTicket(secret: string, ticket: FileTicket) {
	return await hmac(secret, canonical(ticket));
}

export async function verifyFileTicket(
	secret: string,
	ticket: FileTicket,
	signature: string,
	now = Date.now()
) {
	if (ticket.expiresAt < now) return false;
	const expected = await hmac(secret, canonical(ticket));
	if (expected.length !== signature.length) return false;
	let diff = 0;
	for (let i = 0; i < expected.length; i++)
		diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
	return diff === 0;
}

export async function signedFileUrl(baseUrl: string, secret: string, ticket: FileTicket) {
	const signature = await signFileTicket(secret, ticket);
	const url = new URL(filePath(ticket.action), baseUrl);
	url.searchParams.set('key', ticket.key);
	url.searchParams.set('exp', String(ticket.expiresAt));
	if (ticket.contentType !== undefined) url.searchParams.set('ct', ticket.contentType);
	if (ticket.maxSize !== undefined) url.searchParams.set('max', String(ticket.maxSize));
	url.searchParams.set('sig', signature);
	return url.toString();
}

export function filePath(action: FileAction) {
	return action === 'put' ? '/api/files/upload' : '/api/files/object';
}

export function ownsKey(prefix: string, key: string) {
	const rest = key.startsWith(`${prefix}/`) ? key.slice(prefix.length + 1) : '';
	return /^[0-9a-f-]{36}$/.test(rest);
}

export function ticketFromUrl(
	action: FileAction,
	url: URL
): { ticket: FileTicket; signature: string } | null {
	const key = url.searchParams.get('key');
	const exp = url.searchParams.get('exp');
	const signature = url.searchParams.get('sig');
	if (key === null || exp === null || signature === null) return null;
	const contentType = url.searchParams.get('ct') ?? undefined;
	const max = url.searchParams.get('max');
	return {
		ticket: {
			action,
			key,
			expiresAt: Number(exp),
			contentType,
			maxSize: max === null ? undefined : Number(max)
		},
		signature
	};
}

export async function ownerKeyPrefix(owner: string) {
	const digest = await crypto.subtle.digest('SHA-256', encoder.encode(owner));
	return [...new Uint8Array(digest)]
		.slice(0, 12)
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}
