import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

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

const businessPurposeVariable = v.union(
	v.literal('studentOrganization'),
	v.literal('purchaser'),
	v.literal('vendor'),
	v.literal('itemDescription'),
	v.literal('totalAmount'),
	v.literal('recipients'),
	v.literal('recipientUo95Ids'),
	v.literal('activityDate'),
	v.literal('officeLocation'),
	// Deprecated Business Purpose variables. Kept until old rows are backfilled.
	v.literal('eventName'),
	v.literal('eventDate'),
	v.literal('eventTime'),
	v.literal('eventLocation'),
	v.literal('eventEstimatedAttendance'),
	v.literal('activityTime'),
	v.literal('activityLocation'),
	v.literal('estimatedAttendance'),
	v.literal('attendance'),
	v.literal('location')
);

const businessPurposeSource = v.object({
	parts: v.array(
		v.union(
			v.object({ kind: v.literal('text'), text: v.string() }),
			v.object({ kind: v.literal('variable'), variable: businessPurposeVariable })
		)
	)
});

const studentOrganizationDetails = v.object({
	name: v.string(),
	indexNumber: v.string(),
	fundLetter,
	budgetLines: v.array(v.string()),
	businessPurposeTemplate: v.string()
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
		updatedAt: v.number()
	}).index('by_owner', ['owner']),
	organizations: defineTable({
		owner: v.string(),
		name: v.string(),
		indexNumber: v.string(),
		fundLetter,
		budgetLines: v.array(v.string()),
		businessPurposeTemplate: v.string(),
		archived: v.boolean(),
		updatedAt: v.number()
	})
		.index('by_owner_and_archived', ['owner', 'archived'])
		.index('by_owner', ['owner']),
	files: defineTable({
		owner: v.string(),
		kind: fileKind,
		storageId: v.id('_storage'),
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
	businessPurposeTemplates: defineTable({
		owner: v.string(),
		organizationId: v.id('organizations'),
		title: v.string(),
		businessPurposeTemplate: v.string(),
		searchText: v.string(),
		archived: v.boolean(),
		updatedAt: v.number()
	})
		.index('by_owner_and_organizationId_and_archived', ['owner', 'organizationId', 'archived'])
		.index('by_owner_and_organizationId', ['owner', 'organizationId'])
		.index('by_owner_and_archived', ['owner', 'archived'])
		.index('by_owner', ['owner'])
		.searchIndex('search_text', {
			searchField: 'searchText',
			filterFields: ['owner', 'organizationId', 'archived']
		}),
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
		activityDate: v.optional(v.string()),
		// Deprecated after Activity Date replaced Event Details. Kept optional until old rows are backfilled.
		eventName: v.optional(v.string()),
		eventDate: v.optional(v.string()),
		eventTime: v.optional(v.string()),
		eventLocation: v.optional(v.string()),
		eventEstimatedAttendance: v.optional(v.number()),
		vendor: v.string(),
		itemDescription: v.string(),
		totalAmount: v.number(),
		budgetLineItem: v.string(),
		reimbursementReason: v.string(),
		businessPurposeSource,
		businessPurposeTouched: v.boolean(),
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
		createdAt: v.number(),
		updatedAt: v.number(),
		lastFilledAt: v.union(v.number(), v.null())
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
		.index('by_owner', ['owner'])
});
