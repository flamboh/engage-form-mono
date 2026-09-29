import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { documentFacts } from './extraction/facts';

const fundLetter = v.union(
	v.literal('I'),
	v.literal('E'),
	v.literal('G'),
	v.literal('N'),
	v.literal('U'),
	v.literal('D'),
	v.literal('T')
);

const typeOfPurchase = v.union(
	v.literal('personal_reimbursement'),
	v.literal('internal_po'),
	v.literal('external_po'),
	v.literal('pcard'),
	v.literal('co_sponsorship_payment'),
	v.literal('service_agreement_or_purchase_order_for_service')
);

const documentationCategory = v.union(
	v.literal('asuo_funds'),
	v.literal('food'),
	v.literal('printing_services'),
	v.literal('office_supplies_goods'),
	v.literal('merchandise_apparel'),
	v.literal('gifts_prizes')
);

const fileKind = v.union(
	v.literal('receipt'),
	v.literal('id_front'),
	v.literal('id_back'),
	v.literal('second_approval'),
	v.literal('publicity'),
	v.literal('catering_waiver'),
	v.literal('printing_invoice'),
	v.literal('building_manager_approval'),
	v.literal('computer_price_quote'),
	v.literal('brand_approval'),
	v.literal('recipient_list')
);

const recipient = v.object({
	name: v.string(),
	uo95: v.string(),
	reason: v.string(),
	value: v.number()
});

const purchaserRef = v.union(
	v.object({ kind: v.literal('self') }),
	v.object({ kind: v.literal('purchaser'), purchaserId: v.id('purchasers') })
);

const activity = v.object({
	eventId: v.union(v.id('events'), v.null()),
	name: v.string(),
	dates: v.array(v.string()),
	time: v.string(),
	location: v.string(),
	attendance: v.union(v.number(), v.null()),
	openToAllStudents: v.boolean()
});

const studentOrganizationDetails = v.object({
	name: v.string(),
	indexNumber: v.string(),
	fundLetter,
	budgetLines: v.array(v.string())
});

const budgetLine = v.object({
	name: v.string(),
	allocations: v.array(v.object({ fiscalYear: v.number(), amount: v.number() }))
});

const requesterDetails = v.object({
	id: v.id('users'),
	name: v.string(),
	email: v.string(),
	phone: v.string(),
	uo95: v.string(),
	permanentAddress: v.string(),
	idCardFrontFileId: v.id('files'),
	idCardBackFileId: v.union(v.id('files'), v.null())
});

const purchaserDetails = v.object({
	id: v.union(v.id('users'), v.id('purchasers')),
	name: v.string(),
	uo95: v.string(),
	permanentAddress: v.string(),
	idCardFrontFileId: v.id('files'),
	idCardBackFileId: v.union(v.id('files'), v.null())
});

const fieldSource = v.union(
	v.literal('user'),
	v.literal('receipt'),
	v.literal('previous'),
	v.literal('suggested')
);

const extractedField = v.object({
	value: v.string(),
	confident: v.boolean(),
	alternatives: v.array(v.string())
});

export default defineSchema({
	users: defineTable({
		owner: v.string(),
		name: v.string(),
		uo95: v.string(),
		permanentAddress: v.string(),
		studentEmail: v.string(),
		phone: v.string(),
		idCardFrontFileId: v.id('files'),
		idCardBackFileId: v.union(v.id('files'), v.null()),
		pendingFill: v.optional(
			v.union(
				v.object({ purchaseRequestId: v.id('purchaseRequests'), requestedAt: v.number() }),
				v.null()
			)
		),
		updatedAt: v.number()
	}).index('by_owner', ['owner']),
	organizations: defineTable({
		owner: v.string(),
		name: v.string(),
		indexNumber: v.string(),
		fundLetter,
		budgetLines: v.array(budgetLine),
		archived: v.boolean(),
		updatedAt: v.number()
	})
		.index('by_owner_and_archived', ['owner', 'archived'])
		.index('by_owner', ['owner']),
	files: defineTable({
		owner: v.string(),
		kind: fileKind,
		r2Key: v.string(),
		filename: v.string(),
		contentType: v.string(),
		size: v.number(),
		createdAt: v.number()
	}).index('by_owner', ['owner']),
	purchasers: defineTable({
		owner: v.string(),
		organizationId: v.id('organizations'),
		name: v.string(),
		uo95: v.string(),
		permanentAddress: v.string(),
		idCardFrontFileId: v.id('files'),
		idCardBackFileId: v.union(v.id('files'), v.null()),
		archived: v.boolean(),
		updatedAt: v.number()
	})
		.index('by_owner_and_organizationId_and_archived', ['owner', 'organizationId', 'archived'])
		.index('by_owner_and_archived', ['owner', 'archived'])
		.index('by_owner', ['owner']),
	approvers: defineTable({
		owner: v.string(),
		organizationId: v.id('organizations'),
		name: v.string(),
		email: v.string(),
		usedAt: v.number()
	}).index('by_owner_and_organizationId_and_usedAt', ['owner', 'organizationId', 'usedAt']),
	events: defineTable({
		owner: v.string(),
		organizationId: v.id('organizations'),
		name: v.string(),
		weekday: v.union(v.number(), v.null()),
		time: v.string(),
		location: v.string(),
		attendance: v.union(v.number(), v.null()),
		openToAllStudents: v.boolean(),
		lastUsedAt: v.union(v.number(), v.null()),
		archived: v.boolean(),
		updatedAt: v.number()
	}).index('by_owner_and_organizationId_and_archived', ['owner', 'organizationId', 'archived']),
	purchaseRequests: defineTable({
		owner: v.string(),
		status: v.union(v.literal('draft'), v.literal('ready'), v.literal('approved')),
		typeOfPurchase,
		documentationCategories: v.array(documentationCategory),
		organizationSourceId: v.union(v.id('organizations'), v.null()),
		purchaserSource: purchaserRef,
		studentOrganization: studentOrganizationDetails,
		requester: requesterDetails,
		purchaser: purchaserDetails,
		activity,
		vendor: v.string(),
		itemDescription: v.string(),
		totalAmount: v.number(),
		budgetLineItem: v.string(),
		reimbursementReason: v.string(),
		businessPurposeOverride: v.union(v.string(), v.null()),
		receiptFileIds: v.array(v.id('files')),
		secondApprovalFileId: v.union(v.id('files'), v.null()),
		publicityFileId: v.union(v.id('files'), v.null()),
		cateringWaiverFileId: v.union(v.id('files'), v.null()),
		printingInvoiceFileId: v.union(v.id('files'), v.null()),
		brandApprovalFileId: v.union(v.id('files'), v.null()),
		officeLocation: v.string(),
		buildingManagerApprovalFileId: v.union(v.id('files'), v.null()),
		computerPriceQuoteFileId: v.union(v.id('files'), v.null()),
		recipients: v.array(recipient),
		receiptChecks: v.optional(
			v.array(
				v.object({
					field: v.union(v.literal('vendor'), v.literal('itemDescription')),
					value: v.string()
				})
			)
		),
		createdAt: v.number(),
		updatedAt: v.number(),
		lastFilledAt: v.union(v.number(), v.null()),
		reviewerNote: v.union(v.string(), v.null()),
		fieldSources: v.optional(v.record(v.string(), fieldSource)),
		receiptDate: v.optional(v.string()),
		purpose: v.optional(v.string()),
		foodIndividuallyPackaged: v.optional(v.union(v.boolean(), v.null())),
		checkConfirmations: v.optional(v.array(v.object({ id: v.string(), key: v.string() })))
	})
		.index('by_owner_and_organizationSourceId_and_status_and_updatedAt', [
			'owner',
			'organizationSourceId',
			'status',
			'updatedAt'
		])
		.index('by_owner_and_organizationSourceId_and_updatedAt', [
			'owner',
			'organizationSourceId',
			'updatedAt'
		])
		.index('by_owner_and_status_and_updatedAt', ['owner', 'status', 'updatedAt'])
		.index('by_owner_and_status', ['owner', 'status'])
		.index('by_owner', ['owner']),
	extensionSessions: defineTable({
		owner: v.string(),
		tokenHash: v.string(),
		label: v.string(),
		createdAt: v.number(),
		lastUsedAt: v.number(),
		expiresAt: v.number(),
		revokedAt: v.union(v.number(), v.null())
	})
		.index('by_tokenHash', ['tokenHash'])
		.index('by_owner_and_revokedAt_and_expiresAt', ['owner', 'revokedAt', 'expiresAt']),
	extractions: defineTable({
		owner: v.string(),
		fileId: v.id('files'),
		purchaseRequestId: v.union(v.id('purchaseRequests'), v.null()),
		status: v.union(
			v.literal('pending'),
			v.literal('running'),
			v.literal('done'),
			v.literal('failed')
		),
		textSource: v.union(v.literal('text_layer'), v.literal('textract'), v.null()),
		documentKind: v.union(fileKind, v.literal('other'), v.null()),
		vendor: v.union(extractedField, v.null()),
		totalAmount: v.union(extractedField, v.null()),
		receiptDate: v.union(extractedField, v.null()),
		items: v.array(v.string()),
		facts: v.optional(v.union(documentFacts, v.null())),
		error: v.union(v.string(), v.null()),
		attempt: v.optional(v.number()),
		createdAt: v.number(),
		updatedAt: v.number()
	})
		.index('by_fileId', ['fileId'])
		.index('by_purchaseRequestId', ['purchaseRequestId'])
});
