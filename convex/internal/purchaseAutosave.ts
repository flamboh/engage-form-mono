import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { applyDraftPatch, requireOwnedDoc, type DraftPatch } from "../purchaseModel";
import { draftPatch } from "../purchaseValidators";

export const saveDraftPatch = internalMutation({
  args: { id: v.id("purchaseRequests"), owner: v.string(), patch: draftPatch },
  returns: v.null(),
  handler: async (ctx, args) => {
    const request = await requireOwnedDoc(ctx, "purchaseRequests", args.id, args.owner);
    if (request.status !== "draft") return null;
    await ctx.db.patch(args.id, applyDraftPatch(request, args.patch as DraftPatch));
    return null;
  },
});
