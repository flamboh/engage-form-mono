import { v } from 'convex/values';
import { internalMutation } from './_generated/server';
import { ownerKeyPrefix, ownsKey } from './fileSigning';

const seedFile = v.object({
	kind: v.union(v.literal('id_front'), v.literal('id_back')),
	r2Key: v.string(),
	filename: v.string(),
	contentType: v.string(),
	size: v.number()
});

export const restoreOwner = internalMutation({
	args: {
		owner: v.string(),
		profile: v.object({
			name: v.string(),
			studentEmail: v.string(),
			phone: v.string(),
			uo95: v.string(),
			permanentAddress: v.string()
		}),
		idCardFront: seedFile,
		idCardBack: seedFile,
		organizations: v.array(
			v.object({
				name: v.string(),
				indexNumber: v.string(),
				fundLetter: v.union(
					v.literal('I'),
					v.literal('E'),
					v.literal('G'),
					v.literal('N'),
					v.literal('U'),
					v.literal('D'),
					v.literal('T')
				),
				budgetLines: v.array(v.string()),
				events: v.array(
					v.object({
						name: v.string(),
						weekday: v.union(v.number(), v.null()),
						time: v.string(),
						location: v.string(),
						attendance: v.union(v.number(), v.null()),
						openToAllStudents: v.boolean()
					})
				)
			})
		)
	},
	returns: v.object({ organizations: v.number(), events: v.number() }),
	handler: async (ctx, args) => {
		const prefix = await ownerKeyPrefix(args.owner);
		for (const file of [args.idCardFront, args.idCardBack]) {
			if (!ownsKey(prefix, file.r2Key))
				throw new Error(`${file.filename} is not stored for this owner.`);
		}
		const now = Date.now();
		const insertFile = (file: typeof args.idCardFront) =>
			ctx.db.insert('files', { ...file, owner: args.owner, createdAt: now });
		const idCardFrontFileId = await insertFile(args.idCardFront);
		const idCardBackFileId = await insertFile(args.idCardBack);
		const existing = await ctx.db
			.query('users')
			.withIndex('by_owner', (q) => q.eq('owner', args.owner))
			.unique();
		const profile = { ...args.profile, idCardFrontFileId, idCardBackFileId, updatedAt: now };
		if (existing === null) await ctx.db.insert('users', { owner: args.owner, ...profile });
		else await ctx.db.patch(existing._id, profile);
		const current = await ctx.db
			.query('organizations')
			.withIndex('by_owner_and_archived', (q) => q.eq('owner', args.owner).eq('archived', false))
			.take(50);
		let created = 0;
		let createdEvents = 0;
		for (const { events, ...organization } of args.organizations) {
			let organizationId = current.find((item) => item.name === organization.name)?._id;
			if (organizationId === undefined) {
				organizationId = await ctx.db.insert('organizations', {
					...organization,
					owner: args.owner,
					archived: false,
					updatedAt: now
				});
				created += 1;
			}
			const existingEvents = await ctx.db
				.query('events')
				.withIndex('by_owner_and_organizationId_and_archived', (q) =>
					q.eq('owner', args.owner).eq('organizationId', organizationId).eq('archived', false)
				)
				.take(100);
			for (const event of events) {
				if (existingEvents.some((item) => item.name === event.name)) continue;
				await ctx.db.insert('events', {
					...event,
					owner: args.owner,
					organizationId,
					lastUsedAt: null,
					archived: false,
					updatedAt: now
				});
				createdEvents += 1;
			}
		}
		return { organizations: created, events: createdEvents };
	}
});
