import { v } from 'convex/values';
import { type Id } from '../_generated/dataModel';
import { assemblePurchase, assertReady, ownerFromIdentity } from '../purchaseModel';
import { assembledPurchase } from '../purchaseValidators';
import { authedMutation, authedQuery } from './helpers';

const readyPurchaseSummary = v.object({
	id: v.id('purchaseRequests'),
	status: v.literal('ready'),
	organization: v.string(),
	purchaser: v.string(),
	itemDescription: v.string(),
	totalAmount: v.number(),
	updatedAt: v.number(),
	lastFilledAt: v.union(v.number(), v.null())
});

export const listReadyPurchases = authedQuery({
	args: {},
	returns: v.array(readyPurchaseSummary),
	handler: async (ctx) => {
		const owner = ownerFromIdentity(ctx.identity);
		const ready = await ctx.db
			.query('purchaseRequests')
			.withIndex('by_owner_and_status_and_updatedAt', (q) =>
				q.eq('owner', owner).eq('status', 'ready')
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

export const getReadyPurchaseForFill = authedQuery({
	args: { id: v.id('purchaseRequests') },
	returns: assembledPurchase,
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const request = await ctx.db.get(args.id);
		if (request === null || request.owner !== owner) {
			throw new Error('Purchase request not found.');
		}
		if (request.status !== 'ready') {
			throw new Error('Purchase request is not ready.');
		}
		await assertReady(ctx, request);
		return await assemblePurchase(ctx, request);
	}
});

export const markReviewReached = authedMutation({
	args: { id: v.id('purchaseRequests') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const request = await ctx.db.get(args.id as Id<'purchaseRequests'>);
		if (request === null || request.owner !== owner) {
			throw new Error('Purchase request not found.');
		}
		if (request.status !== 'ready') {
			throw new Error('Purchase request is not ready.');
		}
		await ctx.db.patch(args.id, {
			lastFilledAt: Date.now(),
			updatedAt: Date.now()
		});
		return null;
	}
});
