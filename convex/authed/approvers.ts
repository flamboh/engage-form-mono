import { z } from 'zod/v4';
import { zid } from 'convex-helpers/server/zod4';
import { ownerFromIdentity, requireOwnedDoc } from '../purchaseModel';
import { nullReturn } from '../purchaseZod';
import { authedMutation, authedQuery } from './helpers';

const recentLimit = 5;

const approverItem = z.object({
	id: zid('approvers'),
	name: z.string(),
	email: z.string()
});

export const recentApprovers = authedQuery({
	args: { organizationId: zid('organizations') },
	returns: z.array(approverItem),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const rows = await ctx.db
			.query('approvers')
			.withIndex('by_owner_and_organizationId_and_usedAt', (q) =>
				q.eq('owner', owner).eq('organizationId', args.organizationId)
			)
			.order('desc')
			.take(recentLimit);
		return rows.map((row) => ({ id: row._id, name: row.name, email: row.email }));
	}
});

export const rememberApprover = authedMutation({
	args: {
		organizationId: zid('organizations'),
		name: z.string().max(200),
		email: z.string().max(320)
	},
	returns: nullReturn,
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		await requireOwnedDoc(ctx, 'organizations', args.organizationId, owner);
		const name = args.name.trim();
		const email = args.email.trim();
		if (name === '' && email === '') return null;
		const rows = await ctx.db
			.query('approvers')
			.withIndex('by_owner_and_organizationId_and_usedAt', (q) =>
				q.eq('owner', owner).eq('organizationId', args.organizationId)
			)
			.order('desc')
			.take(50);
		const same = rows.find((row) =>
			email === ''
				? row.email === '' && row.name.toLowerCase() === name.toLowerCase()
				: row.email.toLowerCase() === email.toLowerCase()
		);
		const usedAt = Date.now();
		if (same === undefined) {
			await ctx.db.insert('approvers', {
				owner,
				organizationId: args.organizationId,
				name,
				email,
				usedAt
			});
		} else {
			await ctx.db.patch(same._id, { name: name || same.name, email, usedAt });
		}
		for (const stale of rows.slice(recentLimit * 2)) await ctx.db.delete(stale._id);
		return null;
	}
});

export const forgetApprover = authedMutation({
	args: { id: zid('approvers') },
	returns: nullReturn,
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const row = await ctx.db.get(args.id);
		if (row === null || row.owner !== owner) throw new Error('Approver not found.');
		await ctx.db.delete(row._id);
		return null;
	}
});
