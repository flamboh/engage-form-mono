import { z } from 'zod/v4';
import { zid, zCustomMutation } from 'convex-helpers/server/zod4';
import { NoOp } from 'convex-helpers/server/customFunctions';
import { internalMutation } from '../_generated/server';
import { applyDraftPatch, requireOwnedDoc, type DraftPatch } from '../purchaseModel';
import { nullReturn } from '../purchaseZod';

const internalZMutation = zCustomMutation(internalMutation, NoOp);

export const saveDraftPatch = internalZMutation({
	args: { id: zid('purchaseRequests'), owner: z.string(), patch: z.record(z.string(), z.any()) },
	returns: nullReturn,
	handler: async (ctx, args) => {
		const request = await requireOwnedDoc(ctx, 'purchaseRequests', args.id, args.owner);
		await ctx.db.patch(args.id, applyDraftPatch(request, args.patch as DraftPatch));
		return null;
	}
});
