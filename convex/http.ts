import { httpRouter } from 'convex/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { httpAction, type ActionCtx } from './_generated/server';
import { bearerToken, extensionOrigin, hashExtensionToken } from './extensionTokens';

type ExtensionAuth = { owner: string; tokenHash: string };
type ExtensionHandler = (ctx: ActionCtx, auth: ExtensionAuth, request: Request) => Promise<unknown>;

const http = httpRouter();

http.route({
	pathPrefix: '/extension/',
	method: 'OPTIONS',
	handler: httpAction(
		async (_ctx, request) => new Response(null, { status: 204, headers: cors(request) })
	)
});

extensionRoute('GET', '/extension/pending-fill', async (ctx, auth) =>
	ctx.runQuery(internal.extension.getPendingFill, { owner: auth.owner })
);

extensionRoute('POST', '/extension/pending-fill/claim', async (ctx, auth, request) =>
	ctx.runMutation(internal.extension.claimPendingFill, {
		owner: auth.owner,
		purchaseRequestId: await purchaseRequestIdFrom(request)
	})
);

extensionRoute('POST', '/extension/pending-fill/clear', async (ctx, auth, request) =>
	ctx.runMutation(internal.extension.clearPendingFill, {
		owner: auth.owner,
		purchaseRequestId: await purchaseRequestIdFrom(request)
	})
);

extensionRoute('GET', '/extension/ready', async (ctx, auth) =>
	ctx.runQuery(internal.extension.listReadyPurchases, { owner: auth.owner })
);

extensionRoute('GET', '/extension/purchase', async (ctx, auth, request) =>
	ctx.runQuery(internal.extension.getReadyPurchaseForFill, {
		owner: auth.owner,
		id: requiredId(new URL(request.url).searchParams.get('id'))
	})
);

extensionRoute('POST', '/extension/review-reached', async (ctx, auth, request) =>
	ctx.runMutation(internal.extension.markReviewReached, {
		owner: auth.owner,
		id: await purchaseRequestIdFrom(request)
	})
);

extensionRoute('POST', '/extension/sign-out', async (ctx, auth) =>
	ctx.runMutation(internal.extension.revokeByHash, { tokenHash: auth.tokenHash })
);

function extensionRoute(method: 'GET' | 'POST', path: string, handler: ExtensionHandler) {
	http.route({
		path,
		method,
		handler: httpAction(async (ctx, request) => {
			const token = bearerToken(request.headers.get('Authorization'));
			const tokenHash = token === null ? null : await hashExtensionToken(token);
			const session =
				tokenHash === null
					? null
					: await ctx.runMutation(internal.extension.authenticate, { tokenHash });
			if (tokenHash === null || session === null) {
				return json(request, 401, { error: 'Connect the extension to Engage Form.' });
			}
			try {
				const value = await handler(ctx, { owner: session.owner, tokenHash }, request);
				return json(request, 200, { value: value ?? null });
			} catch (error) {
				return json(request, 400, { error: errorMessage(error) });
			}
		})
	});
}

async function purchaseRequestIdFrom(request: Request) {
	const body: unknown = await request.json().catch(() => null);
	const id =
		typeof body === 'object' && body !== null && 'purchaseRequestId' in body
			? body.purchaseRequestId
			: null;
	return requiredId(typeof id === 'string' ? id : null);
}

function requiredId(id: string | null) {
	if (id === null || id.trim() === '') throw new Error('Purchase request id missing.');
	return id as Id<'purchaseRequests'>;
}

function json(request: Request, status: number, body: unknown) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...cors(request), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
	});
}

function cors(request: Request): Record<string, string> {
	if (request.headers.get('Origin') !== extensionOrigin) return { Vary: 'Origin' };
	return {
		'Access-Control-Allow-Origin': extensionOrigin,
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Authorization, Content-Type',
		'Access-Control-Max-Age': '600',
		Vary: 'Origin'
	};
}

function errorMessage(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	const line = message.split('\n').find((part) => part.trim() !== '') ?? message;
	return (
		line.replace(/^(\[[^\]]*\]\s*)*(Uncaught\s+)?(Error:\s*)?/, '').trim() || 'Request failed.'
	);
}

export default http;
