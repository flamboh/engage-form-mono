import { z } from 'zod/v4';
import { zid } from 'convex-helpers/server/zod4';
import { type Doc, type Id } from '../_generated/dataModel';
import { type MutationCtx } from '../_generated/server';
import {
	assemblePurchase,
	assertReady,
	getUserProfile,
	ownerFromIdentity,
	requireOwnedDoc,
	requireUserProfile
} from '../purchaseModel';
import { assembledPurchase, nullReturn } from '../purchaseZod';
import { authedMutation, authedQuery } from './helpers';

export const engagePurchaseRequestUrl =
	'https://uoregon.campuslabs.com/engage/submitter/form/start/730239';

export const pendingFillMaxAgeMs = 30 * 60_000;

const pendingFillView = z.object({
	purchaseRequestId: zid('purchaseRequests'),
	requestedAt: z.number(),
	label: z.string(),
	engageUrl: z.string()
});

const readyPurchaseSummary = z.object({
	id: zid('purchaseRequests'),
	status: z.literal('ready'),
	organization: z.string(),
	purchaser: z.string(),
	itemDescription: z.string(),
	totalAmount: z.number(),
	updatedAt: z.number(),
	lastFilledAt: z.number().nullable()
});

export const listReadyPurchases = authedQuery({
	args: {},
	returns: z.array(readyPurchaseSummary),
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
	args: { id: zid('purchaseRequests') },
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
	args: { id: zid('purchaseRequests') },
	returns: nullReturn,
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
		await clearPendingFillFor(ctx, owner, args.id);
		return null;
	}
});

export const requestFill = authedMutation({
	args: { purchaseRequestId: zid('purchaseRequests') },
	returns: z.object({ engageUrl: z.string() }),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const request = await requireOwnedDoc(ctx, 'purchaseRequests', args.purchaseRequestId, owner);
		if (request.status === 'approved') {
			throw new Error('This purchase request is already approved and can’t be filled again.');
		}
		await assertReady(ctx, request);
		const user = await requireUserProfile(ctx, owner);
		const now = Date.now();
		if (request.status === 'draft') {
			await ctx.db.patch(request._id, { status: 'ready', updatedAt: now });
		}
		await ctx.db.patch(user._id, {
			pendingFill: { purchaseRequestId: request._id, requestedAt: now }
		});
		return { engageUrl: engagePurchaseRequestUrl };
	}
});

export const getPendingFill = authedQuery({
	args: {},
	returns: pendingFillView.nullable(),
	handler: async (ctx) => {
		const owner = ownerFromIdentity(ctx.identity);
		const user = await getUserProfile(ctx, owner);
		const pendingFill = user?.pendingFill ?? null;
		if (pendingFill === null || !isPendingFillFresh(pendingFill.requestedAt, Date.now())) {
			return null;
		}
		const request = await ctx.db.get(pendingFill.purchaseRequestId);
		if (request === null || request.owner !== owner || request.status !== 'ready') return null;
		return pendingFillResult(request, pendingFill.requestedAt);
	}
});

export const claimPendingFill = authedMutation({
	args: { purchaseRequestId: zid('purchaseRequests') },
	returns: pendingFillView.nullable(),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const user = await getUserProfile(ctx, owner);
		const pendingFill = user?.pendingFill ?? null;
		if (user === null || pendingFill === null) return null;
		if (pendingFill.purchaseRequestId !== args.purchaseRequestId) return null;
		await ctx.db.patch(user._id, { pendingFill: null });
		if (!isPendingFillFresh(pendingFill.requestedAt, Date.now())) return null;
		const request = await ctx.db.get(pendingFill.purchaseRequestId);
		if (request === null || request.owner !== owner || request.status !== 'ready') return null;
		return pendingFillResult(request, pendingFill.requestedAt);
	}
});

export const clearPendingFill = authedMutation({
	args: { purchaseRequestId: zid('purchaseRequests') },
	returns: nullReturn,
	handler: async (ctx, args) => {
		await clearPendingFillFor(ctx, ownerFromIdentity(ctx.identity), args.purchaseRequestId);
		return null;
	}
});

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
