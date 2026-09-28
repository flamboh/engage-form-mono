import {
	fileResponse,
	filesBucket,
	preflight,
	servedHeaders,
	verifiedTicket
} from '$lib/server/files';
import type { RequestHandler } from './$types';

export const OPTIONS: RequestHandler = () => preflight();

export const GET: RequestHandler = async ({ url, platform }) => {
	const ticket = await verifiedTicket('get', url);
	if (ticket instanceof Response) return ticket;
	const bucket = filesBucket(platform);
	if (bucket instanceof Response) return bucket;
	const object = await bucket.get(ticket.key);
	if (object === null) return fileResponse('File not found.', 404);
	const headers: Record<string, string> = {
		...servedHeaders(object.httpMetadata?.contentType, object.httpMetadata?.contentDisposition),
		'Content-Length': String(object.size),
		'Cache-Control': 'private, max-age=600',
		'X-Content-Type-Options': 'nosniff',
		ETag: object.httpEtag
	};
	return fileResponse(object.body as unknown as ReadableStream, 200, headers);
};

export const DELETE: RequestHandler = async ({ url, platform }) => {
	const ticket = await verifiedTicket('delete', url);
	if (ticket instanceof Response) return ticket;
	const bucket = filesBucket(platform);
	if (bucket instanceof Response) return bucket;
	await bucket.delete(ticket.key);
	return fileResponse(null, 204);
};
