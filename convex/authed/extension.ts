import { z } from 'zod/v4';
import { zid } from 'convex-helpers/server/zod4';
import { engagePurchaseRequestUrl, pendingFillFor } from '../extension';
import {
	assertReady,
	ownerFromIdentity,
	requireOwnedDoc,
	requireUserProfile
} from '../purchaseModel';
import { authedMutation, authedQuery } from './helpers';

const pendingFillView = z.object({
	purchaseRequestId: zid('purchaseRequests'),
	requestedAt: z.number(),
	label: z.string(),
	engageUrl: z.string()
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
	handler: async (ctx) => await pendingFillFor(ctx, ownerFromIdentity(ctx.identity))
});
