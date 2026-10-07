import { z } from 'zod/v4';
import { zid } from 'convex-helpers/server/zod4';
import { ownerFromIdentity, requireOwnedDoc, requireText } from '../purchaseModel';
import { authedMutation } from './helpers';

export const saveApprover = authedMutation({
	args: {
		organizationId: zid('organizations'),
		purchaserId: zid('purchasers').nullable(),
		name: z.string().max(200),
		email: z.string().max(320),
		title: z.string().max(200)
	},
	returns: zid('purchasers'),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		await requireOwnedDoc(ctx, 'organizations', args.organizationId, owner);
		const name = args.name.trim();
		const email = args.email.trim();
		const now = Date.now();
		const details = { email, title: args.title.trim(), approverUsedAt: now, updatedAt: now };
		if (args.purchaserId !== null) {
			const purchaser = await requireOwnedDoc(ctx, 'purchasers', args.purchaserId, owner);
			if (purchaser.organizationId !== args.organizationId) throw new Error('Record not found.');
			await ctx.db.patch(purchaser._id, details);
			return purchaser._id;
		}
		requireText(name, 'Approver name missing.');
		const purchasers = await ctx.db
			.query('purchasers')
			.withIndex('by_owner_and_organizationId_and_archived', (q) =>
				q.eq('owner', owner).eq('organizationId', args.organizationId).eq('archived', false)
			)
			.take(200);
		const same = purchasers.find((purchaser) =>
			email !== '' && purchaser.email !== undefined && purchaser.email !== ''
				? purchaser.email.toLowerCase() === email.toLowerCase()
				: purchaser.name.trim().toLowerCase() === name.toLowerCase()
		);
		if (same !== undefined) {
			await ctx.db.patch(same._id, details);
			return same._id;
		}
		return await ctx.db.insert('purchasers', {
			owner,
			organizationId: args.organizationId,
			name,
			uo95: '',
			permanentAddress: '',
			idCardFrontFileId: null,
			idCardBackFileId: null,
			archived: false,
			...details
		});
	}
});
