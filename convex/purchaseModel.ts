import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import {
	evaluatePurchaseReadiness,
	formatReadinessBlockers,
	withBlockingChecks
} from './purchaseReadiness';
import { checkInputFrom, requestExtractions, type Extraction } from './checks/load';
import { requestChecks } from './checks/requestChecks';
import { effectiveDocumentationCategories } from './purchaseCategories';
import { fileDownloadUrl } from './files';
import { businessPurposeFor } from './businessPurpose';
import { todayInOregon } from './events';

export { evaluatePurchaseReadiness } from './purchaseReadiness';
export { effectiveDocumentationCategories } from './purchaseCategories';

export type TypeOfPurchase =
	| 'personal_reimbursement'
	| 'internal_po'
	| 'external_po'
	| 'pcard'
	| 'co_sponsorship_payment'
	| 'service_agreement_or_purchase_order_for_service';
export type StudentOrganizationDetails = {
	name: string;
	indexNumber: string;
	fundLetter: Doc<'organizations'>['fundLetter'];
	budgetLines: string[];
};
export type RequesterDetails = {
	id: Id<'users'>;
	name: string;
	email: string;
	phone: string;
	uo95: string;
	permanentAddress: string;
	idCardFrontFileId: Id<'files'> | null;
	idCardBackFileId: Id<'files'> | null;
};
export type PurchaserDetails = {
	id: Id<'users'> | Id<'purchasers'>;
	name: string;
	uo95: string;
	permanentAddress: string;
	idCardFrontFileId: Id<'files'> | null;
	idCardBackFileId: Id<'files'> | null;
};

type Ctx = QueryCtx | MutationCtx;

const fixedPersonalReimbursementReason = 'Other processes are too slow.';

export function ownerFromIdentity(identity: { tokenIdentifier: string }) {
	return identity.tokenIdentifier;
}

export function requireText(value: string, message: string) {
	if (value.trim() === '') throw new Error(message);
}

export async function requireOwnedDoc<
	Table extends 'users' | 'organizations' | 'events' | 'files' | 'purchasers' | 'purchaseRequests'
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

const userTrackedFields = [
	'typeOfPurchase',
	'documentationCategories',
	'purchaserSource',
	'activity',
	'vendor',
	'itemDescription',
	'totalAmount',
	'budgetLineItem',
	'businessPurposeOverride',
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
	purchaserSource: ['purchaserSource', 'purchaser']
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

export type PreviousRequestDefaults = Pick<
	Doc<'purchaseRequests'>,
	| 'purchaserSource'
	| 'budgetLineItem'
	| 'documentationCategories'
	| 'reimbursementReason'
	| 'activity'
>;

export function previousRequestDefaults(
	previous: PreviousRequestDefaults | null,
	organization: Pick<Doc<'organizations'>, '_id' | 'budgetLines'>,
	purchaser: Doc<'purchasers'> | null,
	event: Doc<'events'> | null = null
): Partial<Doc<'purchaseRequests'>> {
	if (previous === null) return {};
	const sources: FieldSources = {};
	const defaults: Partial<Doc<'purchaseRequests'>> = {};
	if (previous.purchaserSource.kind === 'self') {
		sources.purchaserSource = 'previous';
	} else if (
		purchaser !== null &&
		purchaser._id === previous.purchaserSource.purchaserId &&
		!purchaser.archived &&
		purchaser.organizationId === organization._id
	) {
		defaults.purchaserSource = previous.purchaserSource;
		defaults.purchaser = purchaserDetails(purchaser);
		sources.purchaserSource = 'previous';
	}
	if (previous.activity.name.trim() !== '') {
		const eventId = previous.activity.eventId;
		const eventUsable =
			eventId !== null &&
			event !== null &&
			event._id === eventId &&
			!event.archived &&
			event.organizationId === organization._id;
		defaults.activity = {
			...previous.activity,
			eventId: eventUsable ? eventId : null,
			dates: []
		};
		sources.activity = 'previous';
	}
	if (organization.budgetLines.some((line) => line.name === previous.budgetLineItem)) {
		defaults.budgetLineItem = previous.budgetLineItem;
		sources.budgetLineItem = 'previous';
	}
	if (previous.documentationCategories.length > 0) {
		defaults.documentationCategories = previous.documentationCategories;
		sources.documentationCategories = 'previous';
	}
	if (previous.reimbursementReason.trim() !== '') {
		defaults.reimbursementReason = previous.reimbursementReason;
		sources.reimbursementReason = 'previous';
	}
	return { ...defaults, fieldSources: sources };
}

export function withSuggestedEvent(
	defaults: Partial<Doc<'purchaseRequests'>>,
	events: Doc<'events'>[]
): Partial<Doc<'purchaseRequests'>> {
	if (defaults.activity !== undefined) return defaults;
	const event = events
		.filter((item) => !item.archived)
		.sort((a, b) => (b.lastUsedAt ?? b._creationTime) - (a.lastUsedAt ?? a._creationTime))[0];
	if (event === undefined) return defaults;
	return {
		...defaults,
		activity: {
			eventId: event._id,
			name: event.name,
			dates: [],
			time: event.time,
			location: event.location,
			attendance: event.attendance,
			openToAllStudents: event.openToAllStudents
		},
		fieldSources: { ...(defaults.fieldSources ?? {}), activity: 'suggested' }
	};
}

export function renderBusinessPurpose(request: Doc<'purchaseRequests'>, now = Date.now()) {
	return businessPurposeFor(request, todayInOregon(now)).text;
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
	return (await readinessWithChecks(ctx, request)).readiness;
}

export async function readinessWithChecks(
	ctx: Ctx,
	request: Doc<'purchaseRequests'>,
	extractions?: Extraction[]
) {
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
	const checks = requestChecks(
		checkInputFrom(request, extractions ?? (await requestExtractions(ctx, request)))
	);
	return { readiness: withBlockingChecks(readiness, checks), checks };
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
		url: await fileDownloadUrl(doc)
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
		budgetLines: org.budgetLines.map((line) => line.name)
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

function reimbursementReasonFor(typeOfPurchase: TypeOfPurchase) {
	return typeOfPurchase === 'personal_reimbursement' ? fixedPersonalReimbursementReason : '';
}
