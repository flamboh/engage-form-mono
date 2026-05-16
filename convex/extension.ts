import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { authedMutation } from "./authed/helpers";
import { assemblePurchase, assertReady, ownerFromIdentity } from "./purchaseModel";

export const createDeviceLinkToken = authedMutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const owner = ownerFromIdentity(ctx.identity);
    const token = `ef_${crypto.randomUUID()}_${crypto.randomUUID()}`;
    await ctx.db.insert("extensionSessions", {
      owner,
      tokenHash: await hashToken(token),
      name: args.name.trim() === "" ? "Extension" : args.name,
      createdAt: Date.now(),
      lastUsedAt: null,
      revokedAt: null,
    });
    return token;
  },
});

export const listRecentPurchases = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await sessionFromToken(ctx, args.token);
    const ready = await ctx.db
      .query("purchaseRequests")
      .withIndex("by_owner_and_status", (q) => q.eq("owner", session.owner).eq("status", "ready"))
      .order("desc")
      .take(20);
    const filled = await ctx.db
      .query("purchaseRequests")
      .withIndex("by_owner_and_status", (q) => q.eq("owner", session.owner).eq("status", "filled"))
      .order("desc")
      .take(20);
    const rows = [...ready, ...filled]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, 20);

    return await Promise.all(
      rows.map(async (request) => {
        const purchase = await assemblePurchase(ctx, request);
        return {
          id: request._id,
          status: request.status,
          organization: purchase.organization.name,
          purchaser: purchase.purchaser.name,
          itemDescription: purchase.itemDescription,
          totalAmount: purchase.totalAmount,
          updatedAt: request.updatedAt,
          lastFilledAt: request.lastFilledAt,
        };
      }),
    );
  },
});

export const getPurchaseForFill = query({
  args: { token: v.string(), id: v.id("purchaseRequests") },
  handler: async (ctx, args) => {
    const session = await sessionFromToken(ctx, args.token);
    const request = await ctx.db.get(args.id);
    if (request === null || request.owner !== session.owner) throw new Error("Purchase not found.");
    if (request.status !== "ready" && request.status !== "filled") {
      throw new Error("Purchase is not ready.");
    }
    await assertReady(ctx, request);
    return await assemblePurchase(ctx, request);
  },
});

export const markFilled = mutation({
  args: { token: v.string(), id: v.id("purchaseRequests") },
  handler: async (ctx, args) => {
    const session = await sessionFromToken(ctx, args.token);
    const request = await ctx.db.get(args.id);
    if (request === null || request.owner !== session.owner) throw new Error("Purchase not found.");
    if (request.status !== "ready" && request.status !== "filled") {
      throw new Error("Purchase is not ready.");
    }
    await ctx.db.patch(args.id, {
      status: "filled",
      lastFilledAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.db.patch(session._id, { lastUsedAt: Date.now() });
  },
});

async function sessionFromToken(ctx: QueryCtx | MutationCtx, token: string) {
  const tokenHash = await hashToken(token);
  const session = await ctx.db
    .query("extensionSessions")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
    .unique();
  if (session === null || session.revokedAt !== null) throw new Error("Extension not linked.");
  return session;
}

async function hashToken(token: string) {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
