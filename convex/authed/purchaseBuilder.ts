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
	businessPurposeTemplateDraftPatch,
	businessPurposeTemplateFields,
	businessPurposeTemplateUpdateFields,
	getUserProfile,
	ownerFromIdentity,
	parseBusinessPurposeText,
	requireOwnedDoc,
	requireUserProfile,
	requireText,
	userAsPurchaserDetails,
	userAsRequesterDetails,
	type DraftPatch
} from '../purchaseModel';
import {
	draftPatch,
	businessPurposeTemplateDoc,
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
		hasOrganization: v.boolean()
	}),
	handler: async (ctx) => {
		const owner = ownerFromIdentity(ctx.identity);
		const user = await getUserProfile(ctx, owner);
		const organization = await ctx.db
			.query('organizations')
			.withIndex('by_owner', (q) => q.eq('owner', owner))
			.first();
		return {
			hasProfile: user !== null,
			hasOrganization: organization !== null
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
		idCardBackFileId: v.union(v.id('files'), v.null())
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
		if (args.idCardBackFileId !== null) {
			await requireOwnedDoc(ctx, 'files', args.idCardBackFileId, owner);
		}
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
		const businessPurposeTemplates = args.includeArchived
			? await ctx.db
					.query('businessPurposeTemplates')
					.withIndex('by_owner', (q) => q.eq('owner', owner))
					.take(200)
			: await ctx.db
					.query('businessPurposeTemplates')
					.withIndex('by_owner_and_archived', (q) => q.eq('owner', owner).eq('archived', false))
					.take(200);

		return {
			organizations,
			purchasers,
			businessPurposeTemplates
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
		parseBusinessPurposeText(args.businessPurposeTemplate);
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
		idCardBackFileId: v.union(v.id('files'), v.null())
	},
	returns: v.id('purchasers'),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		await requireOwnedDoc(ctx, 'organizations', args.organizationId, owner);
		await requireOwnedDoc(ctx, 'files', args.idCardFrontFileId, owner);
		if (args.idCardBackFileId !== null) {
			await requireOwnedDoc(ctx, 'files', args.idCardBackFileId, owner);
		}
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

export const searchBusinessPurposeTemplates = authedQuery({
	args: {
		organizationId: v.id('organizations'),
		query: v.string(),
		includeArchived: v.optional(v.boolean())
	},
	returns: v.array(businessPurposeTemplateDoc),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		await requireOwnedDoc(ctx, 'organizations', args.organizationId, owner);
		const includeArchived = args.includeArchived ?? false;
		const query = args.query.trim();
		if (query === '') {
			if (includeArchived) {
				return await ctx.db
					.query('businessPurposeTemplates')
					.withIndex('by_owner_and_organizationId', (q) =>
						q.eq('owner', owner).eq('organizationId', args.organizationId)
					)
					.take(50);
			}
			return await ctx.db
				.query('businessPurposeTemplates')
				.withIndex('by_owner_and_organizationId_and_archived', (q) =>
					q.eq('owner', owner).eq('organizationId', args.organizationId).eq('archived', false)
				)
				.take(50);
		}
		if (includeArchived) {
			return await ctx.db
				.query('businessPurposeTemplates')
				.withSearchIndex('search_text', (q) =>
					q.search('searchText', query).eq('owner', owner).eq('organizationId', args.organizationId)
				)
				.take(50);
		}
		return await ctx.db
			.query('businessPurposeTemplates')
			.withSearchIndex('search_text', (q) =>
				q
					.search('searchText', query)
					.eq('owner', owner)
					.eq('organizationId', args.organizationId)
					.eq('archived', false)
			)
			.take(50);
	}
});

export const upsertBusinessPurposeTemplate = authedMutation({
	args: {
		id: v.union(v.id('businessPurposeTemplates'), v.null()),
		organizationId: v.id('organizations'),
		title: v.string(),
		businessPurposeTemplate: v.string()
	},
	returns: v.id('businessPurposeTemplates'),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		await requireOwnedDoc(ctx, 'organizations', args.organizationId, owner);
		if (args.id === null) {
			return await ctx.db.insert(
				'businessPurposeTemplates',
				businessPurposeTemplateFields(owner, args)
			);
		}
		await requireOwnedDoc(ctx, 'businessPurposeTemplates', args.id, owner);
		await ctx.db.patch(args.id, businessPurposeTemplateUpdateFields(args));
		return args.id;
	}
});

export const applyBusinessPurposeTemplate = authedMutation({
	args: {
		draftId: v.id('purchaseRequests'),
		templateId: v.id('businessPurposeTemplates')
	},
	returns: purchaseRequestDoc,
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const draft = await requireOwnedDoc(ctx, 'purchaseRequests', args.draftId, owner);
		if (draft.status !== 'draft') throw new Error('Only draft requests can use templates.');
		const template = await requireOwnedDoc(ctx, 'businessPurposeTemplates', args.templateId, owner);
		if (template.archived) throw new Error('Business Purpose Template archived.');
		if (
			draft.organizationSourceId !== null &&
			template.organizationId !== draft.organizationSourceId
		) {
			throw new Error('Business Purpose Template belongs to another Student Organization.');
		}
		await ctx.db.patch(args.draftId, businessPurposeTemplateDraftPatch(template));
		return await requireOwnedDoc(ctx, 'purchaseRequests', args.draftId, owner);
	}
});

export const setArchived = authedMutation({
	args: {
		table: v.union(
			v.literal('organizations'),
			v.literal('purchasers'),
			v.literal('businessPurposeTemplates')
		),
		id: v.union(v.id('organizations'), v.id('purchasers'), v.id('businessPurposeTemplates')),
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
		const requester = await requireUserProfile(ctx, owner);
		const now = Date.now();
		return await ctx.db.insert('purchaseRequests', {
			owner,
			status: 'draft',
			typeOfPurchase: 'personal_reimbursement',
			documentationCategories: [],
			organizationSourceId: null,
			purchaserSource: { kind: 'self' },
			studentOrganization: {
				name: '',
				indexNumber: '',
				fundLetter: 'I',
				budgetLines: [],
				businessPurposeTemplate: ''
			},
			requester: userAsRequesterDetails(requester),
			purchaser: userAsPurchaserDetails(requester),
			eventName: '',
			eventDate: '',
			eventTime: '',
			eventLocation: '',
			eventEstimatedAttendance: 0,
			vendor: '',
			itemDescription: '',
			totalAmount: 0,
			budgetLineItem: '',
			reimbursementReason: 'Other processes are too slow.',
			businessPurposeSource: { parts: [] },
			businessPurposeTouched: false,
			receiptFileIds: [],
			secondApprovalFileId: null,
			publicityFileId: null,
			cateringWaiverFileId: null,
			printingInvoiceFileId: null,
			brandApprovalFileId: null,
			officeLocation: '',
			buildingManagerApprovalFileId: null,
			computerPriceQuoteFileId: null,
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
		const patch =
			args.patch !== undefined ? applyDraftPatch(request, args.patch as DraftPatch) : {};
		if (Object.keys(patch).length > 0) await ctx.db.patch(args.id, patch);
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
			request.publicityFileId,
			request.cateringWaiverFileId,
			request.printingInvoiceFileId,
			request.brandApprovalFileId,
			request.buildingManagerApprovalFileId,
			request.computerPriceQuoteFileId
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
