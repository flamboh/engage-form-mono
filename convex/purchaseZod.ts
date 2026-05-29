import { z } from 'zod/v4';
import { zid } from 'convex-helpers/server/zod4';

export const nullReturn = z.null();

export const fundLetter = z.union([
	z.literal('I'),
	z.literal('E'),
	z.literal('G'),
	z.literal('N'),
	z.literal('U'),
	z.literal('D'),
	z.literal('T')
]);

export const purchaseStatus = z.union([
	z.literal('draft'),
	z.literal('ready'),
	z.literal('approved')
]);

export const typeOfPurchase = z.union([
	z.literal('personal_reimbursement'),
	z.literal('internal_po'),
	z.literal('external_po'),
	z.literal('pcard'),
	z.literal('co_sponsorship_payment'),
	z.literal('service_agreement_or_purchase_order_for_service')
]);

export const documentationCategory = z.union([
	z.literal('asuo_funds'),
	z.literal('food'),
	z.literal('printing_services'),
	z.literal('office_supplies_goods'),
	z.literal('merchandise_apparel'),
	z.literal('gifts_prizes')
]);

export const fileKind = z.union([
	z.literal('receipt'),
	z.literal('id_front'),
	z.literal('id_back'),
	z.literal('second_approval'),
	z.literal('publicity'),
	z.literal('catering_waiver'),
	z.literal('printing_invoice'),
	z.literal('building_manager_approval'),
	z.literal('computer_price_quote'),
	z.literal('brand_approval'),
	z.literal('recipient_list')
]);

export const recipient = z.object({
	name: z.string(),
	uo95: z.string(),
	reason: z.string(),
	value: z.number()
});

export const purchaserRef = z.union([
	z.object({ kind: z.literal('self') }),
	z.object({ kind: z.literal('purchaser'), purchaserId: zid('purchasers') })
]);

export const businessPurposeVariable = z.union([
	z.literal('studentOrganization'),
	z.literal('purchaser'),
	z.literal('vendor'),
	z.literal('itemDescription'),
	z.literal('totalAmount'),
	z.literal('recipients'),
	z.literal('recipientUo95Ids'),
	z.literal('activityDate'),
	z.literal('officeLocation')
]);

export const businessPurposeSource = z.object({
	parts: z.array(
		z.union([
			z.object({ kind: z.literal('text'), text: z.string() }),
			z.object({ kind: z.literal('variable'), variable: businessPurposeVariable })
		])
	)
});

export const studentOrganizationDetails = z.object({
	name: z.string(),
	indexNumber: z.string(),
	fundLetter,
	budgetLines: z.array(z.string()),
	businessPurposeTemplate: z.string()
});

export const requesterDetails = z.object({
	id: zid('users'),
	name: z.string(),
	email: z.string(),
	phone: z.string(),
	uo95: z.string(),
	permanentAddress: z.string(),
	idCardFrontFileId: zid('files'),
	idCardBackFileId: zid('files').nullable()
});

export const purchaserDetails = z.object({
	id: z.union([zid('users'), zid('purchasers')]),
	name: z.string(),
	uo95: z.string(),
	permanentAddress: z.string(),
	idCardFrontFileId: zid('files'),
	idCardBackFileId: zid('files').nullable()
});

const systemFields = {
	_id: zid('purchaseRequests'),
	_creationTime: z.number()
};

export const userDoc = z.object({
	_id: zid('users'),
	_creationTime: z.number(),
	owner: z.string(),
	name: z.string(),
	uo95: z.string(),
	permanentAddress: z.string(),
	studentEmail: z.string(),
	phone: z.string(),
	idCardFrontFileId: zid('files'),
	idCardBackFileId: zid('files').nullable(),
	updatedAt: z.number()
});

export const organizationDoc = z.object({
	_id: zid('organizations'),
	_creationTime: z.number(),
	owner: z.string(),
	name: z.string(),
	indexNumber: z.string(),
	fundLetter,
	budgetLines: z.array(z.string()),
	businessPurposeTemplate: z.string(),
	archived: z.boolean(),
	updatedAt: z.number()
});

export const fileDoc = z.object({
	_id: zid('files'),
	_creationTime: z.number(),
	owner: z.string(),
	kind: fileKind,
	storageId: zid('_storage'),
	filename: z.string(),
	contentType: z.string(),
	size: z.number(),
	createdAt: z.number()
});

export const purchaserDoc = z.object({
	_id: zid('purchasers'),
	_creationTime: z.number(),
	owner: z.string(),
	organizationId: zid('organizations'),
	name: z.string(),
	uo95: z.string(),
	permanentAddress: z.string(),
	idCardFrontFileId: zid('files'),
	idCardBackFileId: zid('files').nullable(),
	archived: z.boolean(),
	updatedAt: z.number()
});

export const businessPurposeTemplateDoc = z.object({
	_id: zid('businessPurposeTemplates'),
	_creationTime: z.number(),
	owner: z.string(),
	organizationId: zid('organizations'),
	title: z.string(),
	businessPurposeTemplate: z.string(),
	searchText: z.string(),
	archived: z.boolean(),
	updatedAt: z.number()
});

export const purchaseRequestDoc = z.object({
	...systemFields,
	owner: z.string(),
	status: purchaseStatus,
	typeOfPurchase,
	documentationCategories: z.array(documentationCategory),
	organizationSourceId: zid('organizations').nullable(),
	purchaserSource: purchaserRef,
	studentOrganization: studentOrganizationDetails,
	requester: requesterDetails,
	purchaser: purchaserDetails,
	activityDate: z.string(),
	vendor: z.string(),
	itemDescription: z.string(),
	totalAmount: z.number(),
	budgetLineItem: z.string(),
	reimbursementReason: z.string(),
	businessPurposeSource,
	businessPurposeTouched: z.boolean(),
	receiptFileIds: z.array(zid('files')),
	secondApprovalFileId: zid('files').nullable(),
	publicityFileId: zid('files').nullable(),
	cateringWaiverFileId: zid('files').nullable(),
	printingInvoiceFileId: zid('files').nullable(),
	brandApprovalFileId: zid('files').nullable(),
	officeLocation: z.string(),
	buildingManagerApprovalFileId: zid('files').nullable(),
	computerPriceQuoteFileId: zid('files').nullable(),
	recipients: z.array(recipient),
	createdAt: z.number(),
	updatedAt: z.number(),
	lastFilledAt: z.number().nullable()
});

export const savedData = z.object({
	organizations: z.array(organizationDoc),
	purchasers: z.array(purchaserDoc),
	businessPurposeTemplates: z.array(businessPurposeTemplateDoc)
});

export const wizardSnapshot = z.object({
	typeOfPurchase,
	documentationCategories: z.array(documentationCategory),
	purchaserSource: purchaserRef,
	purchaser: purchaserDetails,
	activityDate: z.string(),
	vendor: z.string(),
	itemDescription: z.string(),
	totalAmount: z.number().nullable(),
	budgetLineItem: z.string(),
	businessPurposeText: z.string(),
	businessPurposeTouched: z.boolean(),
	receiptFileIds: z.array(zid('files')),
	secondApprovalFileId: zid('files').nullable(),
	publicityFileId: zid('files').nullable(),
	cateringWaiverFileId: zid('files').nullable(),
	printingInvoiceFileId: zid('files').nullable(),
	brandApprovalFileId: zid('files').nullable(),
	officeLocation: z.string(),
	buildingManagerApprovalFileId: zid('files').nullable(),
	computerPriceQuoteFileId: zid('files').nullable(),
	recipients: z.array(recipient)
});

export const documentPayload = z.object({
	id: zid('files'),
	kind: fileKind,
	filename: z.string(),
	contentType: z.string(),
	size: z.number(),
	storageKey: zid('_storage'),
	url: z.string().nullable()
});

export const assembledPurchase = z.object({
	id: zid('purchaseRequests'),
	status: purchaseStatus,
	typeOfPurchase,
	documentationCategories: z.array(documentationCategory),
	organization: z.object({
		id: zid('organizations').nullable(),
		name: z.string(),
		indexNumber: z.string(),
		fundLetter,
		budgetLines: z.array(z.string())
	}),
	requester: requesterDetails,
	purchaser: purchaserDetails,
	activityDate: z.string(),
	vendor: z.string(),
	itemDescription: z.string(),
	totalAmount: z.number(),
	budgetLineItem: z.string(),
	reimbursementReason: z.string(),
	businessPurposeText: z.string(),
	requesterIsPurchaser: z.boolean(),
	receiptFileIds: z.array(zid('files')),
	secondApprovalFileId: zid('files').nullable(),
	publicityFileId: zid('files').nullable(),
	cateringWaiverFileId: zid('files').nullable(),
	printingInvoiceFileId: zid('files').nullable(),
	brandApprovalFileId: zid('files').nullable(),
	officeLocation: z.string(),
	buildingManagerApprovalFileId: zid('files').nullable(),
	computerPriceQuoteFileId: zid('files').nullable(),
	recipients: z.array(recipient),
	documents: z.array(documentPayload)
});

export type WizardSnapshot = z.infer<typeof wizardSnapshot>;
