import { z } from 'zod/v4';
import { zid } from 'convex-helpers/server/zod4';
import type { Doc, Id } from '../_generated/dataModel';
import { internal } from '../_generated/api';
import { authedMutation, authedQuery } from './helpers';
import { deleteStoredFile, issueUploadTicket, requireOwnedKey } from '../files';
import type { BusinessPurposePart, BusinessPurposeSource } from '../businessPurpose';
import {
	applyDraftPatch,
	assertReady,
	changedSnapshotPatch,
	businessPurposeTemplateDraftPatch,
	businessPurposeTemplateFields,
	businessPurposeTemplateUpdateFields,
	getUserProfile,
	keepFilledFields,
	ownerFromIdentity,
	parseBusinessPurposeText,
	previousRequestDefaults,
	purchaserDetails,
	requireOwnedDoc,
	requireText,
	requireUserProfile,
	studentOrganizationDetails,
	userAsPurchaserDetails,
	userAsRequesterDetails,
	userFieldSources,
	validateBusinessPurposeText,
	type DraftPatch
} from '../purchaseModel';
import {
	businessPurposeTemplateDoc,
	fileKind,
	fundLetter,
	nullReturn,
	purchaseRequestDoc,
	savedData,
	userDoc,
	wizardSnapshot
} from '../purchaseZod';

const createOrganizationArgs = {
	id: zid('organizations').nullable(),
	name: z.string(),
	indexNumber: z.string(),
	fundLetter,
	budgetLines: z.array(z.string()),
	businessPurposeTemplate: z.string()
};

const purchaserArgs = {
	id: zid('purchasers').nullable(),
	organizationId: zid('organizations'),
	name: z.string(),
	uo95: z.string(),
	permanentAddress: z.string(),
	idCardFrontFileId: zid('files'),
	idCardBackFileId: zid('files').nullable()
};

export const getCurrentUser = authedQuery({
	args: {},
	returns: userDoc.nullable(),
	handler: async (ctx) => {
		const owner = ownerFromIdentity(ctx.identity);
		return await getUserProfile(ctx, owner);
	}
});

export const welcomeState = authedQuery({
	args: {},
	returns: z.object({
		hasProfile: z.boolean(),
		hasOrganization: z.boolean()
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
		name: z.string(),
		uo95: z.string(),
		permanentAddress: z.string(),
		studentEmail: z.string(),
		phone: z.string(),
		idCardFrontFileId: zid('files'),
		idCardBackFileId: zid('files').nullable()
	},
	returns: zid('users'),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		requireText(args.name, 'Name missing.');
		requireText(args.uo95, 'UO 95 missing.');
		requireText(args.permanentAddress, 'Permanent address missing.');
		requireText(args.studentEmail, 'Student email missing.');
		requireText(args.phone, 'Phone missing.');
		await requireOwnedDoc(ctx, 'files', args.idCardFrontFileId, owner);
		if (args.idCardBackFileId === null) throw new Error('Back of ID card missing.');
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
	args: { includeArchived: z.boolean() },
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

		return { organizations, purchasers, businessPurposeTemplates };
	}
});

export const listPurchases = authedQuery({
	args: {},
	returns: z.array(purchaseRequestDoc),
	handler: async (ctx) => {
		const owner = ownerFromIdentity(ctx.identity);
		const purchases = await ctx.db
			.query('purchaseRequests')
			.withIndex('by_owner', (q) => q.eq('owner', owner))
			.order('desc')
			.take(50);
		return purchases.map(presentPurchaseRequest);
	}
});

export const listOrganizationPurchases = authedQuery({
	args: { organizationId: zid('organizations') },
	returns: z.array(purchaseRequestDoc),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		await requireOwnedDoc(ctx, 'organizations', args.organizationId, owner);
		const purchases = await ctx.db
			.query('purchaseRequests')
			.withIndex('by_owner_and_organizationSourceId_and_updatedAt', (q) =>
				q.eq('owner', owner).eq('organizationSourceId', args.organizationId)
			)
			.order('desc')
			.take(100);
		return purchases.map(presentPurchaseRequest);
	}
});

export const getDraft = authedQuery({
	args: { id: zid('purchaseRequests') },
	returns: purchaseRequestDoc,
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		return presentPurchaseRequest(await requireOwnedDoc(ctx, 'purchaseRequests', args.id, owner));
	}
});

export const getPurchase = getDraft;

export const createUploadTicket = authedMutation({
	args: { contentType: z.string(), size: z.number() },
	returns: z.object({ uploadUrl: z.string(), r2Key: z.string() }),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		return await issueUploadTicket(owner, args.contentType, args.size);
	}
});

export const saveFile = authedMutation({
	args: {
		kind: fileKind,
		r2Key: z.string(),
		filename: z.string(),
		contentType: z.string(),
		size: z.number()
	},
	returns: zid('files'),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		requireText(args.filename, 'Filename missing.');
		await requireOwnedKey(owner, args.r2Key);
		return await ctx.db.insert('files', { ...args, owner, createdAt: Date.now() });
	}
});

export const upsertOrganization = authedMutation({
	args: createOrganizationArgs,
	returns: zid('organizations'),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		requireText(args.name, 'Organization name missing.');
		requireText(args.indexNumber, 'Index number missing.');
		requireText(args.businessPurposeTemplate, 'Business Purpose Template missing.');
		validateBusinessPurposeText(args.businessPurposeTemplate);
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

export const setOrganizationBusinessPurposeTemplate = authedMutation({
	args: { organizationId: zid('organizations'), businessPurposeTemplate: z.string() },
	returns: nullReturn,
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		await requireOwnedDoc(ctx, 'organizations', args.organizationId, owner);
		requireText(args.businessPurposeTemplate, 'Business Purpose Template missing.');
		validateBusinessPurposeText(args.businessPurposeTemplate);
		await ctx.db.patch(args.organizationId, {
			businessPurposeTemplate: args.businessPurposeTemplate,
			updatedAt: Date.now()
		});
		return null;
	}
});

export const upsertPurchaser = authedMutation({
	args: purchaserArgs,
	returns: zid('purchasers'),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		await requireOwnedDoc(ctx, 'organizations', args.organizationId, owner);
		await requireOwnedDoc(ctx, 'files', args.idCardFrontFileId, owner);
		if (args.idCardBackFileId === null) throw new Error('Back of ID card missing.');
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

export const searchBusinessPurposeTemplates = authedQuery({
	args: {
		organizationId: zid('organizations'),
		query: z.string(),
		includeArchived: z.boolean().optional()
	},
	returns: z.array(businessPurposeTemplateDoc),
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
		id: zid('businessPurposeTemplates').nullable(),
		organizationId: zid('organizations'),
		title: z.string(),
		businessPurposeTemplate: z.string()
	},
	returns: zid('businessPurposeTemplates'),
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
		draftId: zid('purchaseRequests'),
		templateId: zid('businessPurposeTemplates')
	},
	returns: purchaseRequestDoc,
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const draft = await requireOwnedDoc(ctx, 'purchaseRequests', args.draftId, owner);
		if (draft.status === 'approved') throw new Error('Approved requests cannot use templates.');
		const template = await requireOwnedDoc(ctx, 'businessPurposeTemplates', args.templateId, owner);
		if (template.archived) throw new Error('Business Purpose Template archived.');
		if (
			draft.organizationSourceId !== null &&
			template.organizationId !== draft.organizationSourceId
		) {
			throw new Error('Business Purpose Template belongs to another Student Organization.');
		}
		const businessPurposeTemplate = migrateBusinessPurposeTemplate(
			template.businessPurposeTemplate
		);
		if (businessPurposeTemplate !== template.businessPurposeTemplate) {
			await ctx.db.patch(template._id, {
				businessPurposeTemplate,
				searchText: `${template.title} ${businessPurposeTemplate}`,
				updatedAt: Date.now()
			});
		}
		await ctx.db.patch(args.draftId, {
			...businessPurposeTemplateDraftPatch({ ...template, businessPurposeTemplate }),
			fieldSources: { ...(draft.fieldSources ?? {}), businessPurposeSource: 'user' }
		});
		if (draft.status === 'draft' && draft.receiptFileIds.length > 0) {
			await ctx.scheduler.runAfter(0, internal.extraction.jobs.refreshDefaults, {
				purchaseRequestId: args.draftId
			});
		}
		return presentPurchaseRequest(
			await requireOwnedDoc(ctx, 'purchaseRequests', args.draftId, owner)
		);
	}
});

export const backfillMyPurchaseData = authedMutation({
	args: {},
	returns: z.object({
		organizations: z.number(),
		businessPurposeTemplates: z.number(),
		purchaseRequests: z.number()
	}),
	handler: async (ctx) => {
		const owner = ownerFromIdentity(ctx.identity);
		const now = Date.now();
		let organizations = 0;
		let businessPurposeTemplates = 0;
		let purchaseRequests = 0;

		const orgs = await ctx.db
			.query('organizations')
			.withIndex('by_owner', (q) => q.eq('owner', owner))
			.take(200);
		for (const org of orgs) {
			const businessPurposeTemplate = migrateBusinessPurposeTemplate(org.businessPurposeTemplate);
			if (businessPurposeTemplate !== org.businessPurposeTemplate) {
				await ctx.db.patch(org._id, {
					businessPurposeTemplate,
					updatedAt: now
				});
				organizations += 1;
			}
		}

		const templates = await ctx.db
			.query('businessPurposeTemplates')
			.withIndex('by_owner', (q) => q.eq('owner', owner))
			.take(500);
		for (const template of templates) {
			const businessPurposeTemplate = migrateBusinessPurposeTemplate(
				template.businessPurposeTemplate
			);
			if (businessPurposeTemplate !== template.businessPurposeTemplate) {
				await ctx.db.patch(template._id, {
					businessPurposeTemplate,
					searchText: `${template.title} ${businessPurposeTemplate}`,
					updatedAt: now
				});
				businessPurposeTemplates += 1;
			}
		}

		const requests = await ctx.db
			.query('purchaseRequests')
			.withIndex('by_owner', (q) => q.eq('owner', owner))
			.take(500);
		for (const request of requests) {
			const businessPurposeSource = sanitizeBusinessPurposeSource(
				request.businessPurposeSource,
				request
			);
			const activityDate = activityDateForBackfill(request);
			const shouldPatch =
				request.activityDate === undefined ||
				!sameBusinessPurposeSource(businessPurposeSource, request.businessPurposeSource);
			if (shouldPatch) {
				await ctx.db.patch(request._id, {
					activityDate,
					businessPurposeSource,
					updatedAt: now
				});
				purchaseRequests += 1;
			}
		}

		return { organizations, businessPurposeTemplates, purchaseRequests };
	}
});

export const setArchived = authedMutation({
	args: {
		table: z.union([
			z.literal('organizations'),
			z.literal('purchasers'),
			z.literal('businessPurposeTemplates')
		]),
		id: z.union([zid('organizations'), zid('purchasers'), zid('businessPurposeTemplates')]),
		archived: z.boolean()
	},
	returns: nullReturn,
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		await requireOwnedDoc(ctx, args.table, args.id as Id<typeof args.table>, owner);
		await ctx.db.patch(args.id, { archived: args.archived, updatedAt: Date.now() });
		return null;
	}
});

export const createDraft = authedMutation({
	args: {},
	returns: zid('purchaseRequests'),
	handler: async (ctx) => {
		const owner = ownerFromIdentity(ctx.identity);
		const requester = await requireUserProfile(ctx, owner);
		const now = Date.now();
		return await ctx.db.insert('purchaseRequests', emptyDraft(owner, requester, now));
	}
});

export const createDraftForOrganization = authedMutation({
	args: { organizationId: zid('organizations') },
	returns: zid('purchaseRequests'),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const requester = await requireUserProfile(ctx, owner);
		const organization = await requireOwnedDoc(ctx, 'organizations', args.organizationId, owner);
		const now = Date.now();
		const draft = emptyDraft(owner, requester, now);
		const businessPurposeTemplate = migrateBusinessPurposeTemplate(
			organization.businessPurposeTemplate
		);
		if (businessPurposeTemplate !== organization.businessPurposeTemplate) {
			await ctx.db.patch(organization._id, {
				businessPurposeTemplate,
				updatedAt: now
			});
		}
		const previous = await ctx.db
			.query('purchaseRequests')
			.withIndex('by_owner_and_organizationSourceId_and_updatedAt', (q) =>
				q.eq('owner', owner).eq('organizationSourceId', organization._id)
			)
			.order('desc')
			.first();
		const previousPurchaser =
			previous?.purchaserSource.kind === 'purchaser'
				? await ctx.db.get(previous.purchaserSource.purchaserId)
				: null;
		return await ctx.db.insert('purchaseRequests', {
			...draft,
			organizationSourceId: organization._id,
			studentOrganization: studentOrganizationDetails({ ...organization, businessPurposeTemplate }),
			budgetLineItem: organization.budgetLines[0] ?? '',
			businessPurposeSource: parseBusinessPurposeText(businessPurposeTemplate),
			...previousRequestDefaults(
				previous === null ? null : presentPurchaseRequest(previous),
				organization,
				previousPurchaser !== null && previousPurchaser.owner === owner ? previousPurchaser : null
			)
		});
	}
});

export const saveDraftSnapshot = authedMutation({
	args: {
		id: zid('purchaseRequests'),
		snapshot: wizardSnapshot,
		changedFields: z.array(z.string()).optional()
	},
	returns: nullReturn,
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const request = await requireOwnedDoc(ctx, 'purchaseRequests', args.id, owner);
		const changedFields = args.changedFields;
		const patch = withoutDocumentFields(
			changedFields === undefined
				? keepFilledFields(request, snapshotPatch(args.snapshot))
				: changedSnapshotPatch(snapshotPatch(args.snapshot), changedFields)
		);
		if (Object.keys(patch).every((key) => key === 'updatedAt')) return null;
		const fieldSources = userFieldSources(request, patch);
		await ctx.db.patch(args.id, {
			...patch,
			...(fieldSources === request.fieldSources ? {} : { fieldSources }),
			...(request.status === 'approved' ? { status: 'ready' as const } : {})
		});
		return null;
	}
});

const documentFields = [
	'receiptFileIds',
	'secondApprovalFileId',
	'publicityFileId',
	'cateringWaiverFileId',
	'printingInvoiceFileId',
	'brandApprovalFileId',
	'buildingManagerApprovalFileId',
	'computerPriceQuoteFileId'
] as const;

function withoutDocumentFields<T extends object>(patch: T) {
	const rest = { ...patch } as Record<string, unknown>;
	for (const field of documentFields) delete rest[field];
	return rest as Omit<T, (typeof documentFields)[number]>;
}

export const scheduleDraftAutosave = authedMutation({
	args: { id: zid('purchaseRequests'), patch: z.record(z.string(), z.any()) },
	returns: nullReturn,
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const request = await requireOwnedDoc(ctx, 'purchaseRequests', args.id, owner);
		await ctx.db.patch(args.id, applyDraftPatch(request, args.patch as DraftPatch));
		return null;
	}
});

export const markReady = authedMutation({
	args: { id: zid('purchaseRequests'), patch: z.record(z.string(), z.any()).optional() },
	returns: nullReturn,
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

export const markApproved = authedMutation({
	args: { id: zid('purchaseRequests') },
	returns: nullReturn,
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const request = await requireOwnedDoc(ctx, 'purchaseRequests', args.id, owner);
		if (request.status !== 'ready') throw new Error('Only ready requests can be approved.');
		await ctx.db.patch(args.id, { status: 'approved', updatedAt: Date.now() });
		return null;
	}
});

export const markFilled = authedMutation({
	args: { id: zid('purchaseRequests') },
	returns: nullReturn,
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const request = await requireOwnedDoc(ctx, 'purchaseRequests', args.id, owner);
		if (request.status !== 'ready') throw new Error('Only ready requests can be filled.');
		await ctx.db.patch(args.id, {
			lastFilledAt: Date.now(),
			updatedAt: Date.now()
		});
		return null;
	}
});

export const reopenPurchase = authedMutation({
	args: { id: zid('purchaseRequests'), clearFilled: z.boolean() },
	returns: nullReturn,
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		await requireOwnedDoc(ctx, 'purchaseRequests', args.id, owner);
		await ctx.db.patch(args.id, {
			status: 'ready',
			...(args.clearFilled ? { lastFilledAt: null } : {}),
			updatedAt: Date.now()
		});
		return null;
	}
});

export const discardDraft = authedMutation({
	args: { id: zid('purchaseRequests') },
	returns: nullReturn,
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
			await deleteStoredFile(ctx, await requireOwnedDoc(ctx, 'files', fileId, owner));
			const extractions = await ctx.db
				.query('extractions')
				.withIndex('by_fileId', (q) => q.eq('fileId', fileId))
				.take(10);
			for (const extraction of extractions) await ctx.db.delete(extraction._id);
		}
		const detached = await ctx.db
			.query('extractions')
			.withIndex('by_purchaseRequestId', (q) => q.eq('purchaseRequestId', args.id))
			.take(50);
		for (const extraction of detached) await ctx.db.delete(extraction._id);
		await ctx.db.delete(args.id);
		return null;
	}
});

function emptyDraft(
	owner: string,
	requester: Awaited<ReturnType<typeof requireUserProfile>>,
	now: number
) {
	return {
		owner,
		status: 'draft' as const,
		typeOfPurchase: 'personal_reimbursement' as const,
		documentationCategories: [],
		organizationSourceId: null,
		purchaserSource: { kind: 'self' as const },
		studentOrganization: {
			name: '',
			indexNumber: '',
			fundLetter: 'I' as const,
			budgetLines: [],
			businessPurposeTemplate: ''
		},
		requester: userAsRequesterDetails(requester),
		purchaser: userAsPurchaserDetails(requester),
		activityDate: '',
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
	};
}

function snapshotPatch(snapshot: z.infer<typeof wizardSnapshot>) {
	return {
		typeOfPurchase: snapshot.typeOfPurchase,
		documentationCategories: snapshot.documentationCategories,
		purchaserSource: snapshot.purchaserSource,
		purchaser: snapshot.purchaser,
		activityDate: snapshot.activityDate,
		vendor: snapshot.vendor,
		itemDescription: snapshot.itemDescription,
		totalAmount:
			typeof snapshot.totalAmount === 'number' && Number.isFinite(snapshot.totalAmount)
				? snapshot.totalAmount
				: 0,
		budgetLineItem: snapshot.budgetLineItem,
		reimbursementReason:
			snapshot.typeOfPurchase === 'personal_reimbursement' ? 'Other processes are too slow.' : '',
		businessPurposeSource: parseBusinessPurposeText(snapshot.businessPurposeText),
		businessPurposeTouched: snapshot.businessPurposeTouched,
		...(snapshot.purpose === undefined ? {} : { purpose: snapshot.purpose.trim().slice(0, 200) }),
		receiptFileIds: snapshot.receiptFileIds,
		secondApprovalFileId: snapshot.secondApprovalFileId,
		publicityFileId: snapshot.publicityFileId,
		cateringWaiverFileId: snapshot.cateringWaiverFileId,
		printingInvoiceFileId: snapshot.printingInvoiceFileId,
		brandApprovalFileId: snapshot.brandApprovalFileId,
		officeLocation: snapshot.officeLocation,
		buildingManagerApprovalFileId: snapshot.buildingManagerApprovalFileId,
		computerPriceQuoteFileId: snapshot.computerPriceQuoteFileId,
		recipients: snapshot.recipients,
		updatedAt: Date.now()
	};
}

export function presentPurchaseRequest(request: Doc<'purchaseRequests'>) {
	return {
		...request,
		activityDate: activityDateForBackfill(request),
		businessPurposeSource: sanitizeBusinessPurposeSource(request.businessPurposeSource, request)
	};
}

function activityDateForBackfill(request: Doc<'purchaseRequests'> & { eventDate?: string }) {
	return request.activityDate ?? request.eventDate ?? '';
}

function sanitizeBusinessPurposeSource(
	source: unknown,
	request: Doc<'purchaseRequests'>
): BusinessPurposeSource {
	if (!isBusinessPurposeSource(source)) return { parts: [] };
	const parts: BusinessPurposePart[] = [];
	for (const part of source.parts) {
		if (part.kind === 'text') {
			parts.push(part);
			continue;
		}
		if (currentBusinessPurposeVariables.has(part.variable)) {
			parts.push(part as BusinessPurposePart);
			continue;
		}
		if (part.variable === 'eventDate') {
			parts.push({ kind: 'variable', variable: 'activityDate' });
			continue;
		}
		const text = legacyBusinessPurposeValue(part.variable, request);
		if (text !== '') parts.push({ kind: 'text', text });
	}
	return { parts };
}

function isBusinessPurposeSource(source: unknown): source is {
	parts: ({ kind: 'text'; text: string } | { kind: 'variable'; variable: string })[];
} {
	if (typeof source !== 'object' || source === null || !('parts' in source)) return false;
	const parts = (source as { parts: unknown }).parts;
	return Array.isArray(parts);
}

const currentBusinessPurposeVariables = new Set([
	'studentOrganization',
	'purchaser',
	'vendor',
	'itemDescription',
	'totalAmount',
	'recipients',
	'recipientUo95Ids',
	'activityDate',
	'officeLocation',
	'purpose'
]);

function legacyBusinessPurposeValue(variable: string, request: Doc<'purchaseRequests'>) {
	const legacy = request as Doc<'purchaseRequests'> & {
		eventName?: string;
		eventTime?: string;
		eventLocation?: string;
		eventEstimatedAttendance?: number;
	};
	switch (variable) {
		case 'eventName':
			return legacy.eventName ?? '';
		case 'eventTime':
		case 'activityTime':
			return legacy.eventTime ?? '';
		case 'eventLocation':
		case 'activityLocation':
		case 'location':
			return legacy.eventLocation ?? '';
		case 'eventEstimatedAttendance':
		case 'estimatedAttendance':
		case 'attendance':
			return legacy.eventEstimatedAttendance === undefined
				? ''
				: String(legacy.eventEstimatedAttendance);
		default:
			return '';
	}
}

function migrateBusinessPurposeTemplate(template: string) {
	return template
		.replace(
			/\{\s*(org|studentOrg|studentOrganization|Student Organization)\s*\}/g,
			'{Student Organization}'
		)
		.replace(/\{\s*(purchaser|Purchaser)\s*\}/g, '{Purchaser}')
		.replace(/\{\s*(vendor|Vendor)\s*\}/g, '{Vendor}')
		.replace(/\{\s*(item|itemDescription|Item Description)\s*\}/g, '{Item Description}')
		.replace(/\{\s*(amount|totalAmount|Total Amount)\s*\}/g, '{Total Amount}')
		.replace(/\{\s*(recipient|recipientName|recipients|Recipients)\s*\}/g, '{Recipients}')
		.replace(
			/\{\s*(recipientUo95|recipientUo95Ids|Recipient UO 95 IDs)\s*\}/g,
			'{Recipient UO 95 IDs}'
		)
		.replace(/\{\s*(officeLocation|Office Location)\s*\}/g, '{Office Location}')
		.replace(/\{\s*(purpose|Purpose)\s*\}/g, '{Purpose}')
		.replace(/\{\s*(eventDate|Event Date|activityDate|Activity Date)\s*\}/g, '{Activity Date}')
		.replace(
			/\{\s*(recipientReason|reason|eventName|Event Name|eventTime|Event Time|activityTime|Activity Time|eventLocation|Event Location|activityLocation|Activity Location|location|Location|eventEstimatedAttendance|Event Estimated Attendance|estimatedAttendance|Estimated Attendance|attendance|Attendance)\s*\}/g,
			''
		)
		.replace(/\s+([,.])/g, '$1')
		.replace(/[ \t]{2,}/g, ' ')
		.trim();
}

function sameBusinessPurposeSource(left: BusinessPurposeSource, right: unknown) {
	return JSON.stringify(left) === JSON.stringify(right);
}
