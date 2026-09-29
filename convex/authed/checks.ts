import { z } from 'zod/v4';
import { zid } from 'convex-helpers/server/zod4';
import type { Doc } from '../_generated/dataModel';
import { checkInputFrom, requestExtractions } from '../checks/load';
import { confirmationFor, withConfirmation } from '../checks/requestChecks';
import { demoteIfNotReady, ownerFromIdentity, requireOwnedDoc } from '../purchaseModel';
import { nullReturn } from '../purchaseZod';
import { authedMutation } from './helpers';

export const answerFoodPackaging = authedMutation({
	args: { purchaseRequestId: zid('purchaseRequests'), packaged: z.boolean().nullable() },
	returns: nullReturn,
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const request = await requireOwnedDoc(ctx, 'purchaseRequests', args.purchaseRequestId, owner);
		requireEditable(request);
		await ctx.db.patch(request._id, {
			foodIndividuallyPackaged: args.packaged,
			updatedAt: Date.now()
		});
		await demoteIfNotReady(ctx, request._id);
		return null;
	}
});

export const confirmCheck = authedMutation({
	args: { purchaseRequestId: zid('purchaseRequests'), checkId: z.string() },
	returns: nullReturn,
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const request = await requireOwnedDoc(ctx, 'purchaseRequests', args.purchaseRequestId, owner);
		requireEditable(request);
		const input = checkInputFrom(request, await requestExtractions(ctx, request));
		const confirmation = confirmationFor(input, args.checkId);
		if (confirmation === null) throw new Error('This check can’t be confirmed.');
		await ctx.db.patch(request._id, {
			checkConfirmations: withConfirmation(request.checkConfirmations ?? [], confirmation),
			updatedAt: Date.now()
		});
		return null;
	}
});

function requireEditable(request: Doc<'purchaseRequests'>) {
	if (request.status === 'approved') {
		throw new Error('This request is approved. Reopen it before changing it.');
	}
}
