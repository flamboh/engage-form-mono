import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import {
	evaluatePurchaseReadiness,
	formatReadinessBlockers,
	unresolvedToken
} from './purchaseReadiness';
import { effectiveDocumentationCategories } from './purchaseCategories';
import {
	parseBusinessPurposeText,
	resolveBusinessPurpose,
	type BusinessPurposeSource
} from './businessPurpose';
export {
	formatBusinessPurposeSource,
	parseBusinessPurposeText,
	resolveBusinessPurpose,
	validateBusinessPurposeSource
} from './businessPurpose';

export { evaluatePurchaseReadiness, unresolvedToken } from './purchaseReadiness';
export { effectiveDocumentationCategories } from './purchaseCategories';

export type Recipient = { name: string; uo95: string; reason: string; value: number };
type BusinessPurposeRequest = Doc<'purchaseRequests'> & {
	businessPurposeSource?: BusinessPurposeSource;
	businessPurposeText?: string;
};

export type PurchaserRef = { kind: 'self' } | { kind: 'purchaser'; purchaserId: Id<'purchasers'> };
export type TypeOfPurchase =
	| 'personal_reimbursement'
	| 'internal_po'
	| 'external_po'
	| 'pcard'
	| 'co_sponsorship_payment'
	| 'service_agreement_or_purchase_order_for_service';
export type DocumentationCategory =
	| 'asuo_funds'
	| 'food'
	| 'printing_services'
	| 'office_supplies_goods'
	| 'merchandise_apparel'
	| 'gifts_prizes';
export type StudentOrganizationDetails = {
	name: string;
	indexNumber: string;
	fundLetter: Doc<'organizations'>['fundLetter'];
	budgetLines: string[];
	businessPurposeTemplate: string;
};
export type RequesterDetails = {
	id: Id<'users'>;
	name: string;
	email: string;
	phone: string;
	uo95: string;
	permanentAddress: string;
	idCardFrontFileId: Id<'files'>;
	idCardBackFileId: Id<'files'> | null;
};
export type PurchaserDetails = {
	id: Id<'users'> | Id<'purchasers'>;
	name: string;
	uo95: string;
	permanentAddress: string;
	idCardFrontFileId: Id<'files'>;
	idCardBackFileId: Id<'files'> | null;
};

type Ctx = QueryCtx | MutationCtx;

export type DraftPatch = Partial<{
	typeOfPurchase: TypeOfPurchase;
	documentationCategories: DocumentationCategory[];
	organizationSourceId: Id<'organizations'> | null;
	purchaserSource: PurchaserRef;
	studentOrganization: StudentOrganizationDetails;
	requester: RequesterDetails;
	purchaser: PurchaserDetails;
	eventName: string;
	eventDate: string;
	eventTime: string;
	eventLocation: string;
	eventEstimatedAttendance: number | null;
	vendor: string;
	itemDescription: string;
	totalAmount: number | null;
	budgetLineItem: string;
	reimbursementReason: string;
	businessPurposeSource: BusinessPurposeSource;
	businessPurposeText: string;
	businessPurposeTouched: boolean;
	receiptFileIds: Id<'files'>[];
	secondApprovalFileId: Id<'files'> | null;
	publicityFileId: Id<'files'> | null;
	cateringWaiverFileId: Id<'files'> | null;
	printingInvoiceFileId: Id<'files'> | null;
	brandApprovalFileId: Id<'files'> | null;
	officeLocation: string;
	buildingManagerApprovalFileId: Id<'files'> | null;
	computerPriceQuoteFileId: Id<'files'> | null;
	recipients: Recipient[];
}>;

const fixedPersonalReimbursementReason = 'Other processes are too slow.';

export function ownerFromIdentity(identity: { tokenIdentifier: string }) {
	return identity.tokenIdentifier;
}

export function requireText(value: string, message: string) {
	if (value.trim() === '') throw new Error(message);
}

export async function requireOwnedDoc<
	Table extends
		| 'users'
		| 'organizations'
		| 'files'
		| 'purchasers'
		| 'eventPresets'
		| 'purchaseRequests'
>(ctx: Ctx, table: Table, id: Id<Table & string>, owner: string) {
	void table;
	const doc = await ctx.db.get(id);
	if (doc === null || !('owner' in doc) || doc.owner !== owner) {
		throw new Error('Record not found.');
	}
	return doc;
}

export async function getUserProfile(ctx: Ctx, owner: string) {
	return await ctx.db
		.query('users')
		.withIndex('by_owner', (q) => q.eq('owner', owner))
		.unique();
}

export async function requireUserProfile(ctx: Ctx, owner: string) {
	const user = await getUserProfile(ctx, owner);
	if (user === null) throw new Error('Profile missing.');
	return user;
}

export function applyDraftPatch(
	purchase: Doc<'purchaseRequests'>,
	patch: DraftPatch
): Partial<Doc<'purchaseRequests'>> {
	const typeOfPurchase =
		patch.typeOfPurchase !== undefined ? patch.typeOfPurchase : purchase.typeOfPurchase;
	return {
		typeOfPurchase,
		documentationCategories:
			patch.documentationCategories !== undefined
				? patch.documentationCategories
				: purchase.documentationCategories,
		organizationSourceId:
			patch.organizationSourceId !== undefined
				? patch.organizationSourceId
				: purchase.organizationSourceId,
		purchaserSource:
			patch.purchaserSource !== undefined ? patch.purchaserSource : purchase.purchaserSource,
		studentOrganization:
			patch.studentOrganization !== undefined
				? patch.studentOrganization
				: purchase.studentOrganization,
		requester: patch.requester !== undefined ? patch.requester : purchase.requester,
		purchaser: patch.purchaser !== undefined ? patch.purchaser : purchase.purchaser,
		eventName: patch.eventName !== undefined ? patch.eventName : purchase.eventName,
		eventDate: patch.eventDate !== undefined ? patch.eventDate : purchase.eventDate,
		eventTime: patch.eventTime !== undefined ? patch.eventTime : purchase.eventTime,
		eventLocation: patch.eventLocation !== undefined ? patch.eventLocation : purchase.eventLocation,
		eventEstimatedAttendance:
			patch.eventEstimatedAttendance !== undefined
				? numberInput(patch.eventEstimatedAttendance)
				: purchase.eventEstimatedAttendance,
		vendor: patch.vendor !== undefined ? patch.vendor : purchase.vendor,
		itemDescription:
			patch.itemDescription !== undefined ? patch.itemDescription : purchase.itemDescription,
		totalAmount:
			patch.totalAmount !== undefined ? numberInput(patch.totalAmount) : purchase.totalAmount,
		budgetLineItem:
			patch.budgetLineItem !== undefined ? patch.budgetLineItem : purchase.budgetLineItem,
		reimbursementReason: reimbursementReasonFor(typeOfPurchase),
		businessPurposeSource:
			patch.businessPurposeSource ??
			(patch.businessPurposeText !== undefined
				? parseBusinessPurposeText(patch.businessPurposeText)
				: purchase.businessPurposeSource),
		businessPurposeTouched:
			patch.businessPurposeTouched !== undefined
				? patch.businessPurposeTouched
				: purchase.businessPurposeTouched,
		receiptFileIds:
			patch.receiptFileIds !== undefined ? patch.receiptFileIds : purchase.receiptFileIds,
		secondApprovalFileId:
			patch.secondApprovalFileId !== undefined
				? patch.secondApprovalFileId
				: purchase.secondApprovalFileId,
		publicityFileId:
			patch.publicityFileId !== undefined ? patch.publicityFileId : purchase.publicityFileId,
		cateringWaiverFileId:
			patch.cateringWaiverFileId !== undefined
				? patch.cateringWaiverFileId
				: purchase.cateringWaiverFileId,
		printingInvoiceFileId:
			patch.printingInvoiceFileId !== undefined
				? patch.printingInvoiceFileId
				: purchase.printingInvoiceFileId,
		brandApprovalFileId:
			patch.brandApprovalFileId !== undefined
				? patch.brandApprovalFileId
				: purchase.brandApprovalFileId,
		officeLocation:
			patch.officeLocation !== undefined ? patch.officeLocation : purchase.officeLocation,
		buildingManagerApprovalFileId:
			patch.buildingManagerApprovalFileId !== undefined
				? patch.buildingManagerApprovalFileId
				: purchase.buildingManagerApprovalFileId,
		computerPriceQuoteFileId:
			patch.computerPriceQuoteFileId !== undefined
				? patch.computerPriceQuoteFileId
				: purchase.computerPriceQuoteFileId,
		recipients: patch.recipients !== undefined ? patch.recipients : purchase.recipients,
		updatedAt: Date.now()
	};
}

export function renderBusinessPurpose(request: BusinessPurposeRequest) {
	if (request.businessPurposeSource !== undefined) {
		return resolveBusinessPurpose(request.businessPurposeSource, request).text;
	}
	const firstRecipient = request.recipients[0];
	const values: Record<string, string> = {
		org: request.studentOrganization.name || '{org}',
		requester: request.requester.name || '{requester}',
		purchaser: request.purchaser.name || '{purchaser}',
		vendor: request.vendor || '{vendor}',
		item: request.itemDescription || '{item}',
		amount: request.totalAmount > 0 ? formatMoney(request.totalAmount) : '{amount}',
		recipient: firstRecipient?.name || 'N/A',
		recipientUo95: firstRecipient?.uo95 || 'N/A',
		recipientReason: firstRecipient?.reason || 'N/A',
		eventName: request.eventName || '{eventName}',
		eventDate: request.eventDate || '{eventDate}',
		eventTime: request.eventTime || '{eventTime}',
		eventLocation: request.eventLocation || '{eventLocation}',
		attendance:
			request.eventEstimatedAttendance > 0
				? request.eventEstimatedAttendance.toString()
				: '{attendance}'
	};
	return Object.entries(values).reduce(
		(text, [key, value]) => text.replaceAll(`{${key}}`, value),
		request.studentOrganization.businessPurposeTemplate
	);
}

export async function assemblePurchase(ctx: Ctx, request: Doc<'purchaseRequests'>) {
	const documentationCategories = effectiveDocumentationCategories(request);
	const asuoFunds = documentationCategories.includes('asuo_funds');

	if (asuoFunds && request.publicityFileId === null) throw new Error('Publicity proof missing.');

	const purchaserIsSelf = request.purchaserSource.kind === 'self';

	if (purchaserIsSelf && request.secondApprovalFileId === null) {
		throw new Error('Second approval missing.');
	}

	const fileIds = [
		request.purchaser.idCardFrontFileId,
		request.purchaser.idCardBackFileId,
		asuoFunds ? request.publicityFileId : null,
		documentationCategories.includes('food') ? request.cateringWaiverFileId : null,
		documentationCategories.includes('printing_services') ? request.printingInvoiceFileId : null,
		documentationCategories.includes('merchandise_apparel') ? request.brandApprovalFileId : null,
		request.buildingManagerApprovalFileId,
		request.computerPriceQuoteFileId,
		request.secondApprovalFileId,
		...request.receiptFileIds
	].filter((id): id is Id<'files'> => id !== null);
	const documents = await Promise.all(fileIds.map((id) => documentPayload(ctx, id, request.owner)));

	return {
		id: request._id,
		status: request.status,
		typeOfPurchase: request.typeOfPurchase,
		documentationCategories,
		organization: orgPayload(request),
		requester: request.requester,
		purchaser: request.purchaser,
		eventDetails: eventDetailsPayload(request, request.publicityFileId),
		vendor: request.vendor,
		itemDescription: request.itemDescription,
		totalAmount: request.totalAmount,
		budgetLineItem: request.budgetLineItem,
		reimbursementReason: reimbursementReasonFor(request.typeOfPurchase),
		businessPurposeText: renderBusinessPurpose(request),
		requesterIsPurchaser: purchaserIsSelf,
		receiptFileIds: request.receiptFileIds,
		secondApprovalFileId: purchaserIsSelf ? request.secondApprovalFileId : null,
		cateringWaiverFileId: request.cateringWaiverFileId,
		printingInvoiceFileId: request.printingInvoiceFileId,
		brandApprovalFileId: request.brandApprovalFileId,
		officeLocation: request.officeLocation,
		buildingManagerApprovalFileId: request.buildingManagerApprovalFileId,
		computerPriceQuoteFileId: request.computerPriceQuoteFileId,
		recipients: request.recipients,
		documents
	};
}

export async function assertReady(ctx: Ctx, request: Doc<'purchaseRequests'>) {
	const readiness = await evaluatePurchaseReadiness(request, {
		documentExists: async (id) => {
			const doc = await ctx.db.get(id);
			return doc !== null && doc.owner === request.owner;
		},
		purchaserBelongsToOrganization: async (id, organizationId) => {
			const doc = await ctx.db.get(id);
			return doc !== null && doc.owner === request.owner && doc.organizationId === organizationId;
		}
	});
	if (!readiness.ready) throw new Error(formatReadinessBlockers(readiness));
}

async function documentPayload(ctx: Ctx, id: Id<'files'>, owner: string) {
	const doc = await requireOwnedDoc(ctx, 'files', id, owner);
	return {
		id: doc._id,
		kind: doc.kind,
		filename: doc.filename,
		contentType: doc.contentType,
		size: doc.size,
		storageKey: doc.storageId,
		url: await ctx.storage.getUrl(doc.storageId)
	};
}

export function userAsRequesterDetails(user: Doc<'users'>): RequesterDetails {
	return {
		id: user._id,
		name: user.name,
		email: user.studentEmail,
		phone: user.phone,
		uo95: user.uo95,
		permanentAddress: user.permanentAddress,
		idCardFrontFileId: user.idCardFrontFileId,
		idCardBackFileId: user.idCardBackFileId
	};
}

export function userAsPurchaserDetails(user: Doc<'users'>): PurchaserDetails {
	return {
		id: user._id,
		name: user.name,
		uo95: user.uo95,
		permanentAddress: user.permanentAddress,
		idCardFrontFileId: user.idCardFrontFileId,
		idCardBackFileId: user.idCardBackFileId
	};
}

export function purchaserDetails(purchaser: Doc<'purchasers'>): PurchaserDetails {
	return {
		id: purchaser._id,
		name: purchaser.name,
		uo95: purchaser.uo95,
		permanentAddress: purchaser.permanentAddress,
		idCardFrontFileId: purchaser.idCardFrontFileId,
		idCardBackFileId: purchaser.idCardBackFileId
	};
}

export function studentOrganizationDetails(org: Doc<'organizations'>): StudentOrganizationDetails {
	return {
		name: org.name,
		indexNumber: org.indexNumber,
		fundLetter: org.fundLetter,
		budgetLines: org.budgetLines,
		businessPurposeTemplate: org.businessPurposeTemplate
	};
}

function orgPayload(request: Doc<'purchaseRequests'>) {
	return {
		id: request.organizationSourceId,
		name: request.studentOrganization.name,
		indexNumber: request.studentOrganization.indexNumber,
		fundLetter: request.studentOrganization.fundLetter,
		budgetLines: request.studentOrganization.budgetLines
	};
}

function eventDetailsPayload(
	request: Doc<'purchaseRequests'>,
	publicityFileId: Id<'files'> | null
) {
	return {
		name: request.eventName,
		date: request.eventDate,
		time: request.eventTime,
		location: request.eventLocation,
		estimatedAttendance: request.eventEstimatedAttendance,
		publicityProofFileId: publicityFileId
	};
}

function numberInput(value: number | null) {
	return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function formatMoney(value: number) {
	return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function reimbursementReasonFor(typeOfPurchase: TypeOfPurchase) {
	return typeOfPurchase === 'personal_reimbursement' ? fixedPersonalReimbursementReason : '';
}
