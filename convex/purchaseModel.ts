import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { evaluatePurchaseReadiness, formatReadinessBlockers } from './purchaseReadiness';
import { effectiveDocumentationCategories } from './purchaseCategories';
import { fileDownloadUrl } from './files';
import {
	parseBusinessPurposeText,
	resolveBusinessPurpose,
	validateBusinessPurposeText,
	type BusinessPurposeSource
} from './businessPurpose';
export {
	formatBusinessPurposeSource,
	parseBusinessPurposeText,
	resolveBusinessPurpose,
	validateBusinessPurposeSource,
	validateBusinessPurposeText
} from './businessPurpose';

export { evaluatePurchaseReadiness } from './purchaseReadiness';
export { effectiveDocumentationCategories } from './purchaseCategories';

export type Recipient = { name: string; uo95: string; reason: string; value: number };

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
export type BusinessPurposeTemplateInput = {
	organizationId: Id<'organizations'>;
	title: string;
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
	activityDate: string;
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
		| 'businessPurposeTemplates'
		| 'files'
		| 'purchasers'
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
	const next = draftPatchFields(purchase, patch, typeOfPurchase);
	const touched = Object.keys(patch).map((key) =>
		key === 'businessPurposeText' ? 'businessPurposeSource' : key
	);
	const fieldSources = userFieldSources(purchase, next, touched);
	return fieldSources === purchase.fieldSources ? next : { ...next, fieldSources };
}

const userTrackedFields = [
	'typeOfPurchase',
	'documentationCategories',
	'purchaserSource',
	'activityDate',
	'vendor',
	'itemDescription',
	'totalAmount',
	'budgetLineItem',
	'businessPurposeSource',
	'officeLocation',
	'recipients'
] as const;

type FieldSources = NonNullable<Doc<'purchaseRequests'>['fieldSources']>;

export function userFieldSources(
	request: Doc<'purchaseRequests'>,
	next: Partial<Doc<'purchaseRequests'>>,
	fields: readonly string[] = Object.keys(next)
): Doc<'purchaseRequests'>['fieldSources'] {
	const sources: FieldSources = { ...(request.fieldSources ?? {}) };
	let changed = false;
	for (const field of userTrackedFields) {
		if (!fields.includes(field) || !(field in next)) continue;
		if (JSON.stringify(next[field]) === JSON.stringify(request[field])) continue;
		if (sources[field] === 'user') continue;
		sources[field] = 'user';
		changed = true;
	}
	return changed ? sources : request.fieldSources;
}

const snapshotFieldTargets: Record<string, readonly string[]> = {
	typeOfPurchase: ['typeOfPurchase', 'reimbursementReason'],
	purchaserSource: ['purchaserSource', 'purchaser'],
	businessPurposeText: ['businessPurposeSource']
};

export function changedSnapshotPatch<Patch extends object>(
	patch: Patch,
	changedFields: readonly string[]
): Partial<Patch> {
	const keys = new Set(['updatedAt']);
	for (const field of changedFields) {
		for (const key of snapshotFieldTargets[field] ?? [field]) keys.add(key);
	}
	return Object.fromEntries(
		Object.entries(patch).filter(([key]) => keys.has(key))
	) as Partial<Patch>;
}

export function keepFilledFields<Patch extends Partial<Doc<'purchaseRequests'>>>(
	request: Doc<'purchaseRequests'>,
	patch: Patch
): Patch {
	const sources = request.fieldSources ?? {};
	const automatic = (field: string) => sources[field] === 'receipt' || sources[field] === 'default';
	const kept = { ...patch };
	for (const field of ['vendor', 'itemDescription'] as const) {
		if (kept[field] === '' && request[field] !== '' && automatic(field)) delete kept[field];
	}
	if (kept.totalAmount === 0 && request.totalAmount > 0 && automatic('totalAmount')) {
		delete kept.totalAmount;
	}
	if (kept.activityDate === '' && request.activityDate !== '' && automatic('activityDate')) {
		delete kept.activityDate;
	}
	return kept;
}

export type PreviousRequestDefaults = Pick<
	Doc<'purchaseRequests'>,
	| 'purchaserSource'
	| 'budgetLineItem'
	| 'documentationCategories'
	| 'reimbursementReason'
	| 'businessPurposeTouched'
	| 'businessPurposeSource'
>;

export function previousRequestDefaults(
	previous: PreviousRequestDefaults | null,
	organization: Pick<Doc<'organizations'>, '_id' | 'budgetLines'>,
	purchaser: Doc<'purchasers'> | null
): Partial<Doc<'purchaseRequests'>> {
	if (previous === null) return {};
	const sources: FieldSources = {};
	const defaults: Partial<Doc<'purchaseRequests'>> = {};
	if (previous.purchaserSource.kind === 'self') {
		sources.purchaserSource = 'default';
	} else if (
		purchaser !== null &&
		purchaser._id === previous.purchaserSource.purchaserId &&
		!purchaser.archived &&
		purchaser.organizationId === organization._id
	) {
		defaults.purchaserSource = previous.purchaserSource;
		defaults.purchaser = purchaserDetails(purchaser);
		sources.purchaserSource = 'default';
	}
	if (previous.businessPurposeSource.parts.length > 0) {
		defaults.businessPurposeSource = previous.businessPurposeSource;
		defaults.businessPurposeTouched = previous.businessPurposeTouched;
		sources.businessPurposeSource = 'default';
	}
	if (organization.budgetLines.includes(previous.budgetLineItem)) {
		defaults.budgetLineItem = previous.budgetLineItem;
		sources.budgetLineItem = 'default';
	}
	if (previous.documentationCategories.length > 0) {
		defaults.documentationCategories = previous.documentationCategories;
		sources.documentationCategories = 'default';
	}
	if (previous.reimbursementReason.trim() !== '') {
		defaults.reimbursementReason = previous.reimbursementReason;
		sources.reimbursementReason = 'default';
	}
	return { ...defaults, fieldSources: sources };
}

function draftPatchFields(
	purchase: Doc<'purchaseRequests'>,
	patch: DraftPatch,
	typeOfPurchase: TypeOfPurchase
): Partial<Doc<'purchaseRequests'>> {
	return {
		status: 'draft',
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
		activityDate:
			patch.activityDate !== undefined ? patch.activityDate : purchase.activityDate,
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

export function businessPurposeTemplateFields(
	owner: string,
	input: BusinessPurposeTemplateInput,
	updatedAt = Date.now()
) {
	return {
		...businessPurposeTemplateUpdateFields(input, updatedAt),
		owner,
		organizationId: input.organizationId,
		archived: false
	};
}

export function businessPurposeTemplateUpdateFields(
	input: Pick<BusinessPurposeTemplateInput, 'title' | 'businessPurposeTemplate'>,
	updatedAt = Date.now()
) {
	const title = input.title.trim();
	requireText(title, 'Business Purpose Template title missing.');
	requireText(input.businessPurposeTemplate, 'Business Purpose Template missing.');
	validateBusinessPurposeText(input.businessPurposeTemplate);
	return {
		title,
		businessPurposeTemplate: input.businessPurposeTemplate,
		searchText: businessPurposeTemplateSearchText(title, input.businessPurposeTemplate),
		updatedAt
	};
}

export function businessPurposeTemplateDraftPatch(
	template: Pick<Doc<'businessPurposeTemplates'>, 'businessPurposeTemplate'>
): Partial<Doc<'purchaseRequests'>> {
	return {
		businessPurposeSource: parseBusinessPurposeText(template.businessPurposeTemplate),
		businessPurposeTouched: true,
		updatedAt: Date.now()
	};
}

export function filterBusinessPurposeTemplates<
	Template extends Pick<
		Doc<'businessPurposeTemplates'>,
		'title' | 'businessPurposeTemplate' | 'archived'
	>
>(templates: Template[], query: string, options: { includeArchived?: boolean } = {}) {
	const normalizedQuery = normalizeSearch(query);
	return templates.filter((template) => {
		if (!options.includeArchived && template.archived) return false;
		if (normalizedQuery === '') return true;
		return normalizeSearch(
			businessPurposeTemplateSearchText(template.title, template.businessPurposeTemplate)
		).includes(normalizedQuery);
	});
}

export function renderBusinessPurpose(request: Doc<'purchaseRequests'>) {
	return resolveBusinessPurpose(request.businessPurposeSource, request).text;
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
		activityDate: request.activityDate,
		vendor: request.vendor,
		itemDescription: request.itemDescription,
		totalAmount: request.totalAmount,
		budgetLineItem: request.budgetLineItem,
		reimbursementReason: reimbursementReasonFor(request.typeOfPurchase),
		businessPurposeText: renderBusinessPurpose(request),
		requesterIsPurchaser: purchaserIsSelf,
		receiptFileIds: request.receiptFileIds,
		secondApprovalFileId: purchaserIsSelf ? request.secondApprovalFileId : null,
		publicityFileId: request.publicityFileId,
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
	const readiness = await purchaseReadiness(ctx, request);
	if (!readiness.ready) throw new Error(formatReadinessBlockers(readiness));
}

export async function purchaseReadiness(ctx: Ctx, request: Doc<'purchaseRequests'>) {
	return await evaluatePurchaseReadiness(request, {
		documentExists: async (id) => {
			const doc = await ctx.db.get(id);
			return doc !== null && doc.owner === request.owner;
		},
		purchaserBelongsToOrganization: async (id, organizationId) => {
			const doc = await ctx.db.get(id);
			return doc !== null && doc.owner === request.owner && doc.organizationId === organizationId;
		}
	});
}

export async function demoteIfNotReady(ctx: MutationCtx, id: Id<'purchaseRequests'>) {
	const request = await ctx.db.get(id);
	if (request === null || request.status !== 'ready') return;
	if ((await purchaseReadiness(ctx, request)).ready) return;
	await ctx.db.patch(id, { status: 'draft', updatedAt: Date.now() });
}

async function documentPayload(ctx: Ctx, id: Id<'files'>, owner: string) {
	const doc = await requireOwnedDoc(ctx, 'files', id, owner);
	return {
		id: doc._id,
		kind: doc.kind,
		filename: doc.filename,
		contentType: doc.contentType,
		size: doc.size,
		storageKey: doc.r2Key ?? doc.storageId ?? '',
		url: await fileDownloadUrl(ctx, doc)
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

function numberInput(value: number | null) {
	return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function reimbursementReasonFor(typeOfPurchase: TypeOfPurchase) {
	return typeOfPurchase === 'personal_reimbursement' ? fixedPersonalReimbursementReason : '';
}

function businessPurposeTemplateSearchText(title: string, businessPurposeTemplate: string) {
	return `${title} ${businessPurposeTemplate}`;
}

function normalizeSearch(value: string) {
	return value.trim().toLowerCase();
}
