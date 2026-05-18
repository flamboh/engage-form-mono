import { Debouncer } from '@ikhrustalev/convex-debouncer';
import type { DebouncerComponentApi } from '@ikhrustalev/convex-debouncer';
import { v } from 'convex/values';
import { makeFunctionReference, type FunctionReference } from 'convex/server';
import { components } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import { authedMutation, authedQuery } from './helpers';
import {
	applyDraftPatch,
	assertReady,
	getUserProfile,
	ownerFromIdentity,
	requireOwnedDoc,
	requireText,
	type DraftPatch
} from '../purchaseModel';
import {
	draftPatch,
	fileKind,
	fundLetter,
	purchaseRequestDoc,
	savedData,
	userDoc
} from '../purchaseValidators';

const debouncer = new Debouncer(components.debouncer as unknown as DebouncerComponentApi, {
	delay: 1000,
	mode: 'sliding'
});

export const getCurrentUser = authedQuery({
	args: {},
	returns: v.union(userDoc, v.null()),
	handler: async (ctx) => {
		const owner = ownerFromIdentity(ctx.identity);
		return await getUserProfile(ctx, owner);
	}
});

export const welcomeState = authedQuery({
	args: {},
	returns: v.object({
		hasProfile: v.boolean(),
		hasOrganization: v.boolean(),
		hasExtensionLink: v.boolean()
	}),
	handler: async (ctx) => {
		const owner = ownerFromIdentity(ctx.identity);
		const user = await getUserProfile(ctx, owner);
		const organization = await ctx.db
			.query('organizations')
			.withIndex('by_owner', (q) => q.eq('owner', owner))
			.first();
		const activeSession = await ctx.db
			.query('extensionSessions')
			.withIndex('by_owner_and_revokedAt', (q) => q.eq('owner', owner).eq('revokedAt', null))
			.first();
		return {
			hasProfile: user !== null,
			hasOrganization: organization !== null,
			hasExtensionLink: activeSession !== null
		};
	}
});

export const upsertUserProfile = authedMutation({
	args: {
		name: v.string(),
		uo95: v.string(),
		permanentAddress: v.string(),
		studentEmail: v.string(),
		phone: v.string(),
		idCardFrontFileId: v.id('files'),
		idCardBackFileId: v.id('files')
	},
	returns: v.id('users'),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		requireText(args.name, 'Name missing.');
		requireText(args.uo95, 'UO 95 missing.');
		requireText(args.permanentAddress, 'Permanent address missing.');
		requireText(args.studentEmail, 'Student email missing.');
		requireText(args.phone, 'Phone missing.');
		await requireOwnedDoc(ctx, 'files', args.idCardFrontFileId, owner);
		await requireOwnedDoc(ctx, 'files', args.idCardBackFileId, owner);
		const fields = {
			owner,
			name: args.name,
			uo95: args.uo95,
			permanentAddress: args.permanentAddress,
			studentEmail: args.studentEmail,
			phone: args.phone,
			idCardFrontFileId: args.idCardFrontFileId,
			idCardBackFileId: args.idCardBackFileId,
			updatedAt: Date.now()
		};
		const existing = await getUserProfile(ctx, owner);
		if (existing === null) return await ctx.db.insert('users', fields);
		await ctx.db.patch(existing._id, fields);
		return existing._id;
	}
});

export const listSaved = authedQuery({
	args: { includeArchived: v.boolean() },
	returns: savedData,
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const organizations = args.includeArchived
			? await ctx.db
					.query('organizations')
					.withIndex('by_owner', (q) => q.eq('owner', owner))
					.take(100)
			: await ctx.db
					.query('organizations')
					.withIndex('by_owner_and_archived', (q) => q.eq('owner', owner).eq('archived', false))
					.take(100);
		const purchasers = args.includeArchived
			? await ctx.db
					.query('purchasers')
					.withIndex('by_owner', (q) => q.eq('owner', owner))
					.take(200)
			: await ctx.db
					.query('purchasers')
					.withIndex('by_owner_and_archived', (q) => q.eq('owner', owner).eq('archived', false))
					.take(200);
		const eventPresets = args.includeArchived
			? await ctx.db
					.query('eventPresets')
					.withIndex('by_owner', (q) => q.eq('owner', owner))
					.take(200)
			: await ctx.db
					.query('eventPresets')
					.withIndex('by_owner_and_archived', (q) => q.eq('owner', owner).eq('archived', false))
					.take(200);

		return {
			organizations,
			purchasers,
			eventPresets
		};
	}
});

export const listPurchases = authedQuery({
	args: {},
	returns: v.array(purchaseRequestDoc),
	handler: async (ctx) => {
		const owner = ownerFromIdentity(ctx.identity);
		return await ctx.db
			.query('purchaseRequests')
			.withIndex('by_owner', (q) => q.eq('owner', owner))
			.order('desc')
			.take(50);
	}
});

export const getDraft = authedQuery({
	args: { id: v.id('purchaseRequests') },
	returns: purchaseRequestDoc,
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const request = await requireOwnedDoc(ctx, 'purchaseRequests', args.id, owner);
		if (request.status !== 'draft') throw new Error('Only draft requests can be edited.');
		return request;
	}
});

export const generateUploadUrl = authedMutation({
	args: {},
	returns: v.string(),
	handler: async (ctx) => {
		return await ctx.storage.generateUploadUrl();
	}
});

export const saveFile = authedMutation({
	args: {
		kind: fileKind,
		storageId: v.id('_storage'),
		filename: v.string(),
		contentType: v.string(),
		size: v.number()
	},
	returns: v.id('files'),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		requireText(args.filename, 'Filename missing.');
		return await ctx.db.insert('files', { ...args, owner, createdAt: Date.now() });
	}
});

export const upsertOrganization = authedMutation({
	args: {
		id: v.union(v.id('organizations'), v.null()),
		name: v.string(),
		indexNumber: v.string(),
		fundLetter,
		budgetLines: v.array(v.string()),
		businessPurposeTemplate: v.string()
	},
	returns: v.id('organizations'),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		requireText(args.name, 'Organization name missing.');
		requireText(args.indexNumber, 'Index number missing.');
		requireText(args.businessPurposeTemplate, 'Business purpose template missing.');
		const budgetLines = args.budgetLines.map((line) => line.trim()).filter((line) => line !== '');
		if (budgetLines.length === 0) throw new Error('Add at least one budget line.');
		const fields = {
			owner,
			name: args.name,
			indexNumber: args.indexNumber,
			fundLetter: args.fundLetter,
			budgetLines,
			businessPurposeTemplate: args.businessPurposeTemplate,
			archived: false,
			updatedAt: Date.now()
		};
		if (args.id === null) return await ctx.db.insert('organizations', fields);
		await requireOwnedDoc(ctx, 'organizations', args.id, owner);
		await ctx.db.patch(args.id, fields);
		return args.id;
	}
});

export const upsertPurchaser = authedMutation({
	args: {
		id: v.union(v.id('purchasers'), v.null()),
		organizationId: v.id('organizations'),
		name: v.string(),
		uo95: v.string(),
		permanentAddress: v.string(),
		idCardFrontFileId: v.id('files'),
		idCardBackFileId: v.id('files')
	},
	returns: v.id('purchasers'),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		await requireOwnedDoc(ctx, 'organizations', args.organizationId, owner);
		await requireOwnedDoc(ctx, 'files', args.idCardFrontFileId, owner);
		await requireOwnedDoc(ctx, 'files', args.idCardBackFileId, owner);
		requireText(args.name, 'Purchaser name missing.');
		requireText(args.uo95, 'UO 95 missing.');
		requireText(args.permanentAddress, 'Permanent address missing.');
		const fields = {
			owner,
			organizationId: args.organizationId,
			name: args.name,
			uo95: args.uo95,
			permanentAddress: args.permanentAddress,
			idCardFrontFileId: args.idCardFrontFileId,
			idCardBackFileId: args.idCardBackFileId,
			archived: false,
			updatedAt: Date.now()
		};
		if (args.id === null) return await ctx.db.insert('purchasers', fields);
		await requireOwnedDoc(ctx, 'purchasers', args.id, owner);
		await ctx.db.patch(args.id, fields);
		return args.id;
	}
});

export const upsertEventPreset = authedMutation({
	args: {
		id: v.union(v.id('eventPresets'), v.null()),
		organizationId: v.id('organizations'),
		name: v.string(),
		time: v.string(),
		location: v.string(),
		estimatedAttendance: v.number()
	},
	returns: v.id('eventPresets'),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		await requireOwnedDoc(ctx, 'organizations', args.organizationId, owner);
		requireText(args.name, 'Event name missing.');
		requireText(args.time, 'Event time missing.');
		requireText(args.location, 'Event location missing.');
		if (args.estimatedAttendance <= 0) throw new Error('Estimated attendance missing.');
		const fields = {
			owner,
			organizationId: args.organizationId,
			name: args.name,
			time: args.time,
			location: args.location,
			estimatedAttendance: args.estimatedAttendance,
			archived: false,
			updatedAt: Date.now()
		};
		if (args.id === null) return await ctx.db.insert('eventPresets', fields);
		await requireOwnedDoc(ctx, 'eventPresets', args.id, owner);
		await ctx.db.patch(args.id, fields);
		return args.id;
	}
});

export const setArchived = authedMutation({
	args: {
		table: v.union(v.literal('organizations'), v.literal('purchasers'), v.literal('eventPresets')),
		id: v.union(v.id('organizations'), v.id('purchasers'), v.id('eventPresets')),
		archived: v.boolean()
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		await requireOwnedDoc(ctx, args.table, args.id as Id<typeof args.table>, owner);
		await ctx.db.patch(args.id, { archived: args.archived, updatedAt: Date.now() });
		return null;
	}
});

export const createDraft = authedMutation({
	args: {},
	returns: v.id('purchaseRequests'),
	handler: async (ctx) => {
		const owner = ownerFromIdentity(ctx.identity);
		const now = Date.now();
		return await ctx.db.insert('purchaseRequests', {
			owner,
			status: 'draft',
			organizationId: null,
			purchaser: { kind: 'self' },
			eventPresetId: null,
			eventDate: '',
			vendor: '',
			itemDescription: '',
			totalAmount: 0,
			budgetLineItem: '',
			reimbursementReason: '',
			businessPurposeText: '',
			businessPurposeTouched: false,
			receiptFileIds: [],
			secondApprovalFileId: null,
			publicityFileId: null,
			recipients: [],
			createdAt: now,
			updatedAt: now,
			lastFilledAt: null
		});
	}
});

export const scheduleDraftAutosave = authedMutation({
	args: { id: v.id('purchaseRequests'), patch: draftPatch },
	returns: v.null(),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		await requireOwnedDoc(ctx, 'purchaseRequests', args.id, owner);
		await debouncer.schedule(
			ctx,
			'purchase-draft-autosave',
			args.id,
			makeFunctionReference(
				'internal/purchaseAutosave:saveDraftPatch'
			) as unknown as FunctionReference<
				'mutation',
				'internal',
				{ id: Id<'purchaseRequests'>; owner: string; patch: DraftPatch }
			>,
			{ id: args.id, owner, patch: args.patch }
		);
		return null;
	}
});

export const markReady = authedMutation({
	args: { id: v.id('purchaseRequests'), patch: v.optional(draftPatch) },
	returns: v.null(),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const request = await requireOwnedDoc(ctx, 'purchaseRequests', args.id, owner);
		if (args.patch !== undefined) {
			await ctx.db.patch(args.id, applyDraftPatch(request, args.patch as DraftPatch));
		}
		const updated = await requireOwnedDoc(ctx, 'purchaseRequests', args.id, owner);
		await assertReady(ctx, updated);
		await ctx.db.patch(args.id, { status: 'ready', updatedAt: Date.now() });
		return null;
	}
});

export const discardDraft = authedMutation({
	args: { id: v.id('purchaseRequests') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const request = await requireOwnedDoc(ctx, 'purchaseRequests', args.id, owner);
		if (request.status !== 'draft') throw new Error('Only drafts can be discarded.');
		const fileIds = [
			...request.receiptFileIds,
			request.secondApprovalFileId,
			request.publicityFileId
		].filter((id): id is Id<'files'> => id !== null);
		for (const fileId of fileIds) {
			const file = await requireOwnedDoc(ctx, 'files', fileId, owner);
			await ctx.storage.delete(file.storageId);
			await ctx.db.delete(fileId);
		}
		await ctx.db.delete(args.id);
		return null;
	}
});
