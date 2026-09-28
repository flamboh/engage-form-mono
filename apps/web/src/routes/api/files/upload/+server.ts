import { dev } from '$app/environment';
import type { ReadableStream as R2ReadableStream } from '@cloudflare/workers-types';
import {
	fileResponse,
	filesBucket,
	inlineDisposition,
	preflight,
	verifiedTicket
} from '$lib/server/files';
import type { RequestHandler } from './$types';

export const OPTIONS: RequestHandler = () => preflight();

export const PUT: RequestHandler = async ({ request, url, platform }) => {
	const ticket = await verifiedTicket('put', url);
	if (ticket instanceof Response) return ticket;
	const bucket = filesBucket(platform);
	if (bucket instanceof Response) return bucket;
	const lengthHeader = request.headers.get('content-length');
	if (lengthHeader === null) return fileResponse('Content-Length is required.', 411);
	const length = Number(lengthHeader);
	if (!Number.isInteger(length) || length <= 0) return fileResponse('Empty upload.', 400);
	if (ticket.maxSize !== undefined && length > ticket.maxSize)
		return fileResponse('File is too large.', 413);
	if (request.body === null) return fileResponse('Empty upload.', 400);
	const body = dev
		? await request.arrayBuffer()
		: (request.body as unknown as R2ReadableStream);
	await bucket.put(ticket.key, body, {
		httpMetadata: {
			contentType: ticket.contentType ?? 'application/octet-stream',
			contentDisposition: inlineDisposition(request.headers.get('x-file-name'))
		}
	});
	return fileResponse(null, 204);
};
