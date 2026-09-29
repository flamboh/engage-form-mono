import { v } from 'convex/values';
import { z } from 'zod/v4';
import { zid } from 'convex-helpers/server/zod4';
import { internal } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import { action } from '../_generated/server';
import { generateExtensionToken, hashExtensionToken } from '../extensionTokens';
import { ownerFromIdentity } from '../purchaseModel';
import { nullReturn } from '../purchaseZod';
import { authedMutation, authedQuery } from './helpers';

export const connectExtension = action({
	args: { label: v.string() },
	returns: v.object({
		token: v.string(),
		sessionId: v.id('extensionSessions'),
		expiresAt: v.number()
	}),
	handler: async (
		ctx,
		args
	): Promise<{ token: string; sessionId: Id<'extensionSessions'>; expiresAt: number }> => {
		const identity = await ctx.auth.getUserIdentity();
		if (identity === null) throw new Error('Unauthorized');
		const token = generateExtensionToken();
		const session = await ctx.runMutation(internal.extension.createSession, {
			owner: ownerFromIdentity(identity),
			tokenHash: await hashExtensionToken(token),
			label: args.label.trim().slice(0, 80) || 'Chrome extension'
		});
		return { token, ...session };
	}
});

export const listExtensionSessions = authedQuery({
	args: {},
	returns: z.array(
		z.object({
			id: zid('extensionSessions'),
			label: z.string(),
			createdAt: z.number(),
			lastUsedAt: z.number(),
			expiresAt: z.number()
		})
	),
	handler: async (ctx) => {
		const sessions = await ctx.db
			.query('extensionSessions')
			.withIndex('by_owner_and_revokedAt_and_expiresAt', (q) =>
				q
					.eq('owner', ownerFromIdentity(ctx.identity))
					.eq('revokedAt', null)
					.gt('expiresAt', Date.now())
			)
			.order('desc')
			.take(20);
		return sessions.map((session) => ({
			id: session._id,
			label: session.label,
			createdAt: session.createdAt,
			lastUsedAt: session.lastUsedAt,
			expiresAt: session.expiresAt
		}));
	}
});

export const disconnectExtension = authedMutation({
	args: { sessionId: zid('extensionSessions') },
	returns: nullReturn,
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		if (session === null || session.owner !== ownerFromIdentity(ctx.identity)) return null;
		if (session.revokedAt === null) await ctx.db.patch(session._id, { revokedAt: Date.now() });
		return null;
	}
});
