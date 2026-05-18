import { v } from 'convex/values';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { authedMutation, authedQuery } from './authed/helpers';
import { assemblePurchase, assertReady, ownerFromIdentity } from './purchaseModel';
import { assembledPurchase } from './purchaseValidators';

const deviceToken = v.object({
	id: v.id('extensionSessions'),
	name: v.string(),
	createdAt: v.number(),
	lastUsedAt: v.union(v.number(), v.null()),
	revokedAt: v.union(v.number(), v.null())
});

const recentPurchase = v.object({
	id: v.id('purchaseRequests'),
	status: v.literal('ready'),
	organization: v.string(),
	purchaser: v.string(),
	itemDescription: v.string(),
	totalAmount: v.number(),
	updatedAt: v.number(),
	lastFilledAt: v.union(v.number(), v.null())
});

export const createDeviceLinkToken = authedMutation({
	args: { name: v.string() },
	returns: v.string(),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const token = `ef_${crypto.randomUUID()}_${crypto.randomUUID()}`;
		await ctx.db.insert('extensionSessions', {
			owner,
			tokenHash: await hashToken(token),
			name: args.name.trim() === '' ? 'Extension' : args.name,
			createdAt: Date.now(),
			lastUsedAt: null,
			revokedAt: null
		});
		return token;
	}
});

export const listDeviceTokens = authedQuery({
	args: {},
	returns: v.array(deviceToken),
	handler: async (ctx) => {
		const owner = ownerFromIdentity(ctx.identity);
		const sessions = await ctx.db
			.query('extensionSessions')
			.withIndex('by_owner', (q) => q.eq('owner', owner))
			.order('desc')
			.take(50);
		return sessions.map((session) => ({
			id: session._id,
			name: session.name,
			createdAt: session.createdAt,
			lastUsedAt: session.lastUsedAt,
			revokedAt: session.revokedAt
		}));
	}
});

export const revokeDeviceToken = authedMutation({
	args: { id: v.id('extensionSessions') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const session = await ctx.db.get(args.id);
		if (session === null || session.owner !== owner) throw new Error('Token not found.');
		await ctx.db.patch(args.id, { revokedAt: Date.now() });
		return null;
	}
});

export const hasActiveDeviceToken = authedQuery({
	args: {},
	returns: v.boolean(),
	handler: async (ctx) => {
		const owner = ownerFromIdentity(ctx.identity);
		const activeSession = await ctx.db
			.query('extensionSessions')
			.withIndex('by_owner_and_revokedAt', (q) => q.eq('owner', owner).eq('revokedAt', null))
			.first();
		return activeSession !== null;
	}
});

export const listRecentPurchases = query({
	args: { token: v.string() },
	returns: v.array(recentPurchase),
	handler: async (ctx, args) => {
		const session = await sessionFromToken(ctx, args.token);
		const ready = await ctx.db
			.query('purchaseRequests')
			.withIndex('by_owner_and_status_and_updatedAt', (q) =>
				q.eq('owner', session.owner).eq('status', 'ready')
			)
			.order('desc')
			.take(20);

		return await Promise.all(
			ready.map(async (request) => {
				const purchase = await assemblePurchase(ctx, request);
				return {
					id: request._id,
					status: 'ready' as const,
					organization: purchase.organization.name,
					purchaser: purchase.purchaser.name,
					itemDescription: purchase.itemDescription,
					totalAmount: purchase.totalAmount,
					updatedAt: request.updatedAt,
					lastFilledAt: request.lastFilledAt
				};
			})
		);
	}
});

export const getPurchaseForFill = query({
	args: { token: v.string(), id: v.id('purchaseRequests') },
	returns: assembledPurchase,
	handler: async (ctx, args) => {
		const session = await sessionFromToken(ctx, args.token);
		const request = await ctx.db.get(args.id);
		if (request === null || request.owner !== session.owner) throw new Error('Purchase not found.');
		if (request.status !== 'ready') {
			throw new Error('Purchase is not ready.');
		}
		await assertReady(ctx, request);
		return await assemblePurchase(ctx, request);
	}
});

export const markReviewReached = mutation({
	args: { token: v.string(), id: v.id('purchaseRequests') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const session = await sessionFromToken(ctx, args.token);
		const request = await ctx.db.get(args.id);
		if (request === null || request.owner !== session.owner) throw new Error('Purchase not found.');
		if (request.status !== 'ready') {
			throw new Error('Purchase is not ready.');
		}
		await ctx.db.patch(args.id, {
			lastFilledAt: Date.now(),
			updatedAt: Date.now()
		});
		await ctx.db.patch(session._id, { lastUsedAt: Date.now() });
		return null;
	}
});

async function sessionFromToken(ctx: QueryCtx | MutationCtx, token: string) {
	const tokenHash = await hashToken(token);
	const session = await ctx.db
		.query('extensionSessions')
		.withIndex('by_tokenHash', (q) => q.eq('tokenHash', tokenHash))
		.unique();
	if (session === null || session.revokedAt !== null) throw new Error('Extension not linked.');
	return session;
}

async function hashToken(token: string) {
	const data = new TextEncoder().encode(token);
	const digest = await crypto.subtle.digest('SHA-256', data);
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}
