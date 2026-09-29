import { z } from 'zod/v4';
import { zid } from 'convex-helpers/server/zod4';
import type { Doc, Id } from '../_generated/dataModel';
import { authedMutation, authedQuery } from './helpers';
import { deleteStoredFile, issueUploadTicket, requireOwnedKey } from '../files';
import {
	changedSnapshotPatch,
	getUserProfile,
	ownerFromIdentity,
	previousRequestDefaults,
	withSuggestedEvent,
	purchaserDetails,
	requireOwnedDoc,
	requireText,
	requireUserProfile,
	studentOrganizationDetails,
	userAsPurchaserDetails,
	userAsRequesterDetails,
	userFieldSources
} from '../purchaseModel';
import { normalizeActivity } from './events';
import {
	budgetLine,
	fileKind,
	fundLetter,
	nullReturn,
	savedData,
	userDoc,
	wizardSnapshot
} from '../purchaseZod';

const createOrganizationArgs = {
	id: zid('organizations').nullable(),
	name: z.string(),
	indexNumber: z.string(),
	fundLetter,
	budgetLines: z.array(budgetLine)
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
		idCardFrontFileId: zid('files').nullable(),
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
		for (const fileId of [args.idCardFrontFileId, args.idCardBackFileId]) {
			if (fileId !== null) await requireOwnedDoc(ctx, 'files', fileId, owner);
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
		return { organizations, purchasers };
	}
});

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
		const budgetLines = normalizeBudgetLines(args.budgetLines);
		if (budgetLines.length === 0) throw new Error('Add at least one budget line.');
		const fields = {
			owner,
			name: args.name,
			indexNumber: args.indexNumber,
			fundLetter: args.fundLetter,
			budgetLines,
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

export const setArchived = authedMutation({
	args: {
		table: z.union([z.literal('organizations'), z.literal('purchasers')]),
		id: z.union([zid('organizations'), zid('purchasers')]),
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

export const createDraftForOrganization = authedMutation({
	args: { organizationId: zid('organizations') },
	returns: zid('purchaseRequests'),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const requester = await requireUserProfile(ctx, owner);
		const organization = await requireOwnedDoc(ctx, 'organizations', args.organizationId, owner);
		const now = Date.now();
		const draft = emptyDraft(owner, requester, now);
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
		const previousEvent =
			previous?.activity.eventId != null ? await ctx.db.get(previous.activity.eventId) : null;
		const events = await ctx.db
			.query('events')
			.withIndex('by_owner_and_organizationId_and_archived', (q) =>
				q.eq('owner', owner).eq('organizationId', organization._id).eq('archived', false)
			)
			.take(20);
		return await ctx.db.insert('purchaseRequests', {
			...draft,
			organizationSourceId: organization._id,
			studentOrganization: studentOrganizationDetails(organization),
			budgetLineItem: organization.budgetLines[0]?.name ?? '',
			...withSuggestedEvent(
				previousRequestDefaults(
					previous,
					organization,
					previousPurchaser !== null && previousPurchaser.owner === owner
						? previousPurchaser
						: null,
					previousEvent !== null && previousEvent.owner === owner ? previousEvent : null
				),
				events
			)
		});
	}
});

export const saveDraftSnapshot = authedMutation({
	args: {
		id: zid('purchaseRequests'),
		snapshot: wizardSnapshot,
		changedFields: z.array(z.string())
	},
	returns: nullReturn,
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const request = await requireOwnedDoc(ctx, 'purchaseRequests', args.id, owner);
		const patch = withoutDocumentFields(
			changedSnapshotPatch(snapshotPatch(args.snapshot), args.changedFields)
		);
		if (Object.keys(patch).every((key) => key === 'updatedAt')) return null;
		const eventId = patch.activity?.eventId ?? null;
		if (eventId !== null) {
			const event = await requireOwnedDoc(ctx, 'events', eventId, owner);
			if (event.organizationId !== request.organizationSourceId) {
				throw new Error('Event belongs to another Student Organization.');
			}
			if (eventId !== request.activity.eventId) {
				await ctx.db.patch(eventId, { lastUsedAt: Date.now() });
			}
		}
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
			budgetLines: []
		},
		requester: userAsRequesterDetails(requester),
		purchaser: userAsPurchaserDetails(requester),
		activity: {
			eventId: null,
			name: '',
			dates: [],
			time: '',
			location: '',
			attendance: null,
			openToAllStudents: true
		},
		vendor: '',
		itemDescription: '',
		totalAmount: 0,
		budgetLineItem: '',
		reimbursementReason: 'Other processes are too slow.',
		businessPurposeOverride: null,
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
		lastFilledAt: null,
		approvedAt: null,
		reviewerNote: null
	};
}

function normalizeBudgetLines(lines: z.infer<typeof budgetLine>[]) {
	const result: z.infer<typeof budgetLine>[] = [];
	for (const line of lines) {
		const name = line.name.trim();
		if (name === '' || result.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
			continue;
		}
		const allocations = new Map<number, number>();
		for (const allocation of line.allocations) {
			if (!Number.isInteger(allocation.fiscalYear)) throw new Error('Fiscal year is invalid.');
			if (!Number.isFinite(allocation.amount) || allocation.amount < 0) {
				throw new Error(`Allocation for ${name} must be zero or more.`);
			}
			allocations.set(allocation.fiscalYear, Math.round(allocation.amount * 100) / 100);
		}
		result.push({
			name,
			allocations: [...allocations]
				.sort(([a], [b]) => a - b)
				.map(([fiscalYear, amount]) => ({ fiscalYear, amount }))
		});
	}
	return result;
}

function snapshotPatch(snapshot: z.infer<typeof wizardSnapshot>) {
	return {
		typeOfPurchase: snapshot.typeOfPurchase,
		documentationCategories: snapshot.documentationCategories,
		purchaserSource: snapshot.purchaserSource,
		purchaser: snapshot.purchaser,
		activity: normalizeActivity(snapshot.activity),
		vendor: snapshot.vendor,
		itemDescription: snapshot.itemDescription,
		totalAmount:
			typeof snapshot.totalAmount === 'number' && Number.isFinite(snapshot.totalAmount)
				? snapshot.totalAmount
				: 0,
		budgetLineItem: snapshot.budgetLineItem,
		reimbursementReason:
			snapshot.typeOfPurchase === 'personal_reimbursement' ? 'Other processes are too slow.' : '',
		businessPurposeOverride: normalizeOverride(snapshot.businessPurposeOverride),
		purpose: snapshot.purpose.trim().slice(0, 200),
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

function normalizeOverride(value: string | null) {
	if (value === null) return null;
	const text = value.trim().slice(0, 2000);
	return text === '' ? null : text;
}
