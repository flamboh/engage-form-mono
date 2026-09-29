import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import {
	internalMutation,
	internalQuery,
	type MutationCtx,
	type QueryCtx
} from './_generated/server';
import {
	extensionSessionExpiry,
	extensionSessionStatus,
	shouldTouchExtensionSession
} from './extensionTokens';
import { assemblePurchase, assertReady, getUserProfile } from './purchaseModel';

export const engagePurchaseRequestUrl =
	'https://uoregon.campuslabs.com/engage/forms?query=request%20to%20purchase';

const pendingFillMaxAgeMs = 30 * 60_000;

export const authenticate = internalMutation({
	args: { tokenHash: v.string() },
	returns: v.union(v.object({ owner: v.string(), sessionId: v.id('extensionSessions') }), v.null()),
	handler: async (ctx, args) => {
		const session = await sessionByHash(ctx, args.tokenHash);
		if (session === null) return null;
		const now = Date.now();
		if (extensionSessionStatus(session, now) !== 'active') return null;
		if (shouldTouchExtensionSession(session, now)) {
			await ctx.db.patch(session._id, { lastUsedAt: now, expiresAt: extensionSessionExpiry(now) });
		}
		return { owner: session.owner, sessionId: session._id };
	}
});

export const revokeByHash = internalMutation({
	args: { tokenHash: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const session = await sessionByHash(ctx, args.tokenHash);
		if (session === null || session.revokedAt !== null) return null;
		await ctx.db.patch(session._id, { revokedAt: Date.now() });
		return null;
	}
});

export const createSession = internalMutation({
	args: { owner: v.string(), tokenHash: v.string(), label: v.string() },
	returns: v.object({ sessionId: v.id('extensionSessions'), expiresAt: v.number() }),
	handler: async (ctx, args) => {
		const now = Date.now();
		const expiresAt = extensionSessionExpiry(now);
		const sessionId = await ctx.db.insert('extensionSessions', {
			owner: args.owner,
			tokenHash: args.tokenHash,
			label: args.label,
			createdAt: now,
			lastUsedAt: now,
			expiresAt,
			revokedAt: null
		});
		return { sessionId, expiresAt };
	}
});

export const listReadyPurchases = internalQuery({
	args: { owner: v.string() },
	handler: async (ctx, args) => {
		const ready = await ctx.db
			.query('purchaseRequests')
			.withIndex('by_owner_and_status_and_updatedAt', (q) =>
				q.eq('owner', args.owner).eq('status', 'ready')
			)
			.order('desc')
			.take(20);

		return ready.map((request) => ({
			id: request._id,
			status: 'ready' as const,
			organization: request.studentOrganization.name,
			purchaser: request.purchaser.name,
			itemDescription: request.itemDescription,
			totalAmount: request.totalAmount,
			updatedAt: request.updatedAt,
			lastFilledAt: request.lastFilledAt
		}));
	}
});

export const getReadyPurchaseForFill = internalQuery({
	args: { owner: v.string(), id: v.id('purchaseRequests') },
	handler: async (ctx, args) => {
		const request = await requireReadyRequest(ctx, args.owner, args.id);
		await assertReady(ctx, request);
		return await assemblePurchase(ctx, request);
	}
});

export const markReviewReached = internalMutation({
	args: { owner: v.string(), id: v.id('purchaseRequests') },
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireReadyRequest(ctx, args.owner, args.id);
		const now = Date.now();
		await ctx.db.patch(args.id, { lastFilledAt: now, updatedAt: now });
		await clearPendingFillFor(ctx, args.owner, args.id);
		return null;
	}
});

export const getPendingFill = internalQuery({
	args: { owner: v.string() },
	handler: async (ctx, args) => await pendingFillFor(ctx, args.owner)
});

export const claimPendingFill = internalMutation({
	args: { owner: v.string(), purchaseRequestId: v.id('purchaseRequests') },
	handler: async (ctx, args) => {
		const user = await getUserProfile(ctx, args.owner);
		const pendingFill = user?.pendingFill ?? null;
		if (user === null || pendingFill === null) return null;
		if (pendingFill.purchaseRequestId !== args.purchaseRequestId) return null;
		await ctx.db.patch(user._id, { pendingFill: null });
		if (!isPendingFillFresh(pendingFill.requestedAt, Date.now())) return null;
		const request = await ctx.db.get(pendingFill.purchaseRequestId);
		if (request === null || request.owner !== args.owner || request.status !== 'ready') return null;
		return pendingFillResult(request, pendingFill.requestedAt);
	}
});

export const clearPendingFill = internalMutation({
	args: { owner: v.string(), purchaseRequestId: v.id('purchaseRequests') },
	returns: v.null(),
	handler: async (ctx, args) => {
		await clearPendingFillFor(ctx, args.owner, args.purchaseRequestId);
		return null;
	}
});

export async function pendingFillFor(ctx: QueryCtx, owner: string) {
	const user = await getUserProfile(ctx, owner);
	const pendingFill = user?.pendingFill ?? null;
	if (pendingFill === null || !isPendingFillFresh(pendingFill.requestedAt, Date.now())) {
		return null;
	}
	const request = await ctx.db.get(pendingFill.purchaseRequestId);
	if (request === null || request.owner !== owner || request.status !== 'ready') return null;
	return pendingFillResult(request, pendingFill.requestedAt);
}

async function sessionByHash(ctx: QueryCtx, tokenHash: string) {
	return await ctx.db
		.query('extensionSessions')
		.withIndex('by_tokenHash', (q) => q.eq('tokenHash', tokenHash))
		.unique();
}

async function requireReadyRequest(ctx: QueryCtx, owner: string, id: Id<'purchaseRequests'>) {
	const request = await ctx.db.get(id);
	if (request === null || request.owner !== owner) {
		throw new Error('Purchase request not found.');
	}
	if (request.status !== 'ready') {
		throw new Error('Purchase request is not ready.');
	}
	return request;
}

async function clearPendingFillFor(
	ctx: MutationCtx,
	owner: string,
	purchaseRequestId: Id<'purchaseRequests'>
) {
	const user = await getUserProfile(ctx, owner);
	if (user?.pendingFill?.purchaseRequestId !== purchaseRequestId) return;
	await ctx.db.patch(user._id, { pendingFill: null });
}

function isPendingFillFresh(requestedAt: number, now: number) {
	return now - requestedAt <= pendingFillMaxAgeMs;
}

function pendingFillResult(request: Doc<'purchaseRequests'>, requestedAt: number) {
	return {
		purchaseRequestId: request._id,
		requestedAt,
		label: pendingFillLabel(request),
		engageUrl: engagePurchaseRequestUrl
	};
}

function pendingFillLabel(request: Doc<'purchaseRequests'>) {
	const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
		request.totalAmount
	);
	const name = request.vendor.trim() || request.itemDescription.trim();
	return name === '' ? amount : `${name} · ${amount}`;
}
