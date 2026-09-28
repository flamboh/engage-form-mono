import { env } from '$env/dynamic/private';
import {
	ticketFromUrl,
	verifyFileTicket,
	type FileAction,
	type FileTicket
} from '$convex/fileSigning';
import type { R2Bucket } from '@cloudflare/workers-types';

export const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, HEAD, PUT, DELETE, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, X-File-Name',
	'Access-Control-Max-Age': '86400'
};

export function fileResponse(body: BodyInit | null, status: number, headers: HeadersInit = {}) {
	return new Response(body, { status, headers: { ...corsHeaders, ...headers } });
}

export function preflight() {
	return fileResponse(null, 204);
}

export async function verifiedTicket(action: FileAction, url: URL): Promise<FileTicket | Response> {
	const secret = env.FILES_SIGNING_SECRET;
	if (!secret) return fileResponse('File storage is not configured.', 503);
	const parsed = ticketFromUrl(action, url);
	if (parsed === null || !Number.isFinite(parsed.ticket.expiresAt))
		return fileResponse('Missing file ticket.', 400);
	if (!(await verifyFileTicket(secret, parsed.ticket, parsed.signature)))
		return fileResponse('Invalid or expired file ticket.', 403);
	return parsed.ticket;
}

export function filesBucket(platform: App.Platform | undefined): R2Bucket | Response {
	return platform?.env.FILES ?? fileResponse('File storage is not configured.', 503);
}

export function inlineDisposition(encodedName: string | null) {
	if (encodedName === null) return undefined;
	let name: string;
	try {
		name = decodeURIComponent(encodedName);
	} catch {
		return undefined;
	}
	const trimmed = name.replace(/[\r\n"\\/]/g, '').slice(0, 255);
	if (trimmed === '') return undefined;
	const ascii = trimmed.replace(/[^\x20-\x7e]/g, '_');
	return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(trimmed)}`;
}

const inlineTypes = new Set([
	'application/pdf',
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/heic',
	'image/heif',
	'image/avif',
	'text/plain',
	'text/csv'
]);

export function servedHeaders(contentType: string | undefined, disposition: string | undefined) {
	const type = contentType?.split(';')[0].trim().toLowerCase() ?? '';
	if (inlineTypes.has(type))
		return { 'Content-Type': contentType ?? type, 'Content-Disposition': disposition ?? 'inline' };
	return {
		'Content-Type': 'application/octet-stream',
		'Content-Disposition': (disposition ?? 'inline').replace(/^inline/, 'attachment')
	};
}
