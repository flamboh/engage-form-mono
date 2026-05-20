import { v } from 'convex/values';

export const fundLetter = v.union(
	v.literal('I'),
	v.literal('E'),
	v.literal('G'),
	v.literal('N'),
	v.literal('U'),
	v.literal('D'),
	v.literal('T')
);

export const typeOfPurchase = v.union(
	v.literal('personal_reimbursement'),
	v.literal('internal_po'),
	v.literal('external_po'),
	v.literal('pcard'),
	v.literal('co_sponsorship_payment'),
	v.literal('service_agreement_or_purchase_order_for_service')
);

export const documentationCategory = v.union(
	v.literal('asuo_funds'),
	v.literal('food'),
	v.literal('printing_services'),
	v.literal('office_supplies_goods'),
	v.literal('merchandise_apparel'),
	v.literal('gifts_prizes')
);

export const fileKind = v.union(
	v.literal('receipt'),
	v.literal('id_card'),
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

export const recipient = v.object({
	name: v.string(),
	uo95: v.string(),
	reason: v.string(),
	value: v.number()
});

export const purchaserRef = v.union(
	v.object({ kind: v.literal('self') }),
	v.object({ kind: v.literal('purchaser'), purchaserId: v.id('purchasers') })
);

export const businessPurposeVariable = v.union(
	v.literal('studentOrganization'),
	v.literal('purchaser'),
	v.literal('vendor'),
	v.literal('itemDescription'),
	v.literal('totalAmount'),
	v.literal('recipients'),
	v.literal('recipientUo95Ids'),
	v.literal('activityDate'),
	v.literal('activityTime'),
	v.literal('activityLocation'),
	v.literal('estimatedAttendance'),
	v.literal('officeLocation')
);

export const businessPurposeSource = v.object({
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

export const draftPatch = v.object({
	typeOfPurchase: v.optional(typeOfPurchase),
	documentationCategories: v.optional(v.array(documentationCategory)),
	organizationSourceId: v.optional(v.union(v.id('organizations'), v.null())),
	purchaserSource: v.optional(purchaserRef),
	studentOrganization: v.optional(studentOrganizationDetails),
	requester: v.optional(requesterDetails),
	purchaser: v.optional(purchaserDetails),
	eventName: v.optional(v.string()),
	eventDate: v.optional(v.string()),
	eventTime: v.optional(v.string()),
	eventLocation: v.optional(v.string()),
	eventEstimatedAttendance: v.optional(v.union(v.number(), v.null())),
	vendor: v.optional(v.string()),
	itemDescription: v.optional(v.string()),
	totalAmount: v.optional(v.union(v.number(), v.null())),
	budgetLineItem: v.optional(v.string()),
	reimbursementReason: v.optional(v.string()),
	businessPurposeSource: v.optional(businessPurposeSource),
	businessPurposeText: v.optional(v.string()),
	businessPurposeTouched: v.optional(v.boolean()),
	receiptFileIds: v.optional(v.array(v.id('files'))),
	secondApprovalFileId: v.optional(v.union(v.id('files'), v.null())),
	publicityFileId: v.optional(v.union(v.id('files'), v.null())),
	cateringWaiverFileId: v.optional(v.union(v.id('files'), v.null())),
	printingInvoiceFileId: v.optional(v.union(v.id('files'), v.null())),
	brandApprovalFileId: v.optional(v.union(v.id('files'), v.null())),
	officeLocation: v.optional(v.string()),
	buildingManagerApprovalFileId: v.optional(v.union(v.id('files'), v.null())),
	computerPriceQuoteFileId: v.optional(v.union(v.id('files'), v.null())),
	recipients: v.optional(v.array(recipient))
});

const systemFields = {
	_id: v.id('purchaseRequests'),
	_creationTime: v.number()
};

export const userDoc = v.object({
	_id: v.id('users'),
	_creationTime: v.number(),
	owner: v.string(),
	name: v.string(),
	uo95: v.string(),
	permanentAddress: v.string(),
	studentEmail: v.string(),
	phone: v.string(),
	idCardFrontFileId: v.id('files'),
	idCardBackFileId: v.union(v.id('files'), v.null()),
	updatedAt: v.number()
});

export const organizationDoc = v.object({
	_id: v.id('organizations'),
	_creationTime: v.number(),
	owner: v.string(),
	name: v.string(),
	indexNumber: v.string(),
	fundLetter,
	budgetLines: v.array(v.string()),
	businessPurposeTemplate: v.string(),
	archived: v.boolean(),
	updatedAt: v.number()
});

export const fileDoc = v.object({
	_id: v.id('files'),
	_creationTime: v.number(),
	owner: v.string(),
	kind: fileKind,
	storageId: v.id('_storage'),
	filename: v.string(),
	contentType: v.string(),
	size: v.number(),
	createdAt: v.number()
});

export const purchaserDoc = v.object({
	_id: v.id('purchasers'),
	_creationTime: v.number(),
	owner: v.string(),
	organizationId: v.id('organizations'),
	name: v.string(),
	uo95: v.string(),
	permanentAddress: v.string(),
	idCardFrontFileId: v.id('files'),
	idCardBackFileId: v.union(v.id('files'), v.null()),
	archived: v.boolean(),
	updatedAt: v.number()
});

export const businessPurposeTemplateDoc = v.object({
	_id: v.id('businessPurposeTemplates'),
	_creationTime: v.number(),
	owner: v.string(),
	organizationId: v.id('organizations'),
	title: v.string(),
	businessPurposeTemplate: v.string(),
	searchText: v.string(),
	archived: v.boolean(),
	updatedAt: v.number()
});

export const purchaseRequestDoc = v.object({
	...systemFields,
	owner: v.string(),
	status: v.union(v.literal('draft'), v.literal('ready')),
	typeOfPurchase,
	documentationCategories: v.array(documentationCategory),
	organizationSourceId: v.union(v.id('organizations'), v.null()),
	purchaserSource: purchaserRef,
	studentOrganization: studentOrganizationDetails,
	requester: requesterDetails,
	purchaser: purchaserDetails,
	eventName: v.string(),
	eventDate: v.string(),
	eventTime: v.string(),
	eventLocation: v.string(),
	eventEstimatedAttendance: v.number(),
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
});

export const savedData = v.object({
	organizations: v.array(organizationDoc),
	purchasers: v.array(purchaserDoc),
	businessPurposeTemplates: v.array(businessPurposeTemplateDoc)
});

export const documentPayload = v.object({
	id: v.id('files'),
	kind: fileKind,
	filename: v.string(),
	contentType: v.string(),
	size: v.number(),
	storageKey: v.id('_storage'),
	url: v.union(v.string(), v.null())
});

export const assembledPurchase = v.object({
	id: v.id('purchaseRequests'),
	status: v.union(v.literal('draft'), v.literal('ready')),
	typeOfPurchase,
	documentationCategories: v.array(documentationCategory),
	organization: v.object({
		id: v.union(v.id('organizations'), v.null()),
		name: v.string(),
		indexNumber: v.string(),
		fundLetter,
		budgetLines: v.array(v.string())
	}),
	requester: v.object({
		id: v.id('users'),
		name: v.string(),
		email: v.string(),
		phone: v.string(),
		uo95: v.string(),
		permanentAddress: v.string(),
		idCardFrontFileId: v.id('files'),
		idCardBackFileId: v.union(v.id('files'), v.null())
	}),
	purchaser: v.object({
		id: v.union(v.id('users'), v.id('purchasers')),
		name: v.string(),
		uo95: v.string(),
		permanentAddress: v.string(),
		idCardFrontFileId: v.id('files'),
		idCardBackFileId: v.union(v.id('files'), v.null())
	}),
	eventDetails: v.object({
		name: v.string(),
		date: v.string(),
		time: v.string(),
		location: v.string(),
		estimatedAttendance: v.number(),
		publicityProofFileId: v.union(v.id('files'), v.null())
	}),
	vendor: v.string(),
	itemDescription: v.string(),
	totalAmount: v.number(),
	budgetLineItem: v.string(),
	reimbursementReason: v.string(),
	businessPurposeText: v.string(),
	requesterIsPurchaser: v.boolean(),
	receiptFileIds: v.array(v.id('files')),
	secondApprovalFileId: v.union(v.id('files'), v.null()),
	cateringWaiverFileId: v.union(v.id('files'), v.null()),
	printingInvoiceFileId: v.union(v.id('files'), v.null()),
	brandApprovalFileId: v.union(v.id('files'), v.null()),
	officeLocation: v.string(),
	buildingManagerApprovalFileId: v.union(v.id('files'), v.null()),
	computerPriceQuoteFileId: v.union(v.id('files'), v.null()),
	recipients: v.array(recipient),
	documents: v.array(documentPayload)
});
