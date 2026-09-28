import type { Doc, Id } from '../_generated/dataModel';
import { describeItems } from './candidates';
import type { DocumentKind } from './jev';

export type FieldSource = 'user' | 'receipt' | 'previous' | 'suggested';
export type FieldSources = Record<string, FieldSource>;
export type ExtractedReviewField = 'vendor' | 'totalAmount' | 'receiptDate';
export type CheckField = 'vendor' | 'itemDescription';
export type ReviewField = ExtractedReviewField | CheckField;
export type ReceiptCheck = { field: CheckField; value: string };
export type Slot =
	| 'receipt'
	| 'second_approval'
	| 'publicity'
	| 'catering_waiver'
	| 'printing_invoice'
	| 'building_manager_approval'
	| 'computer_price_quote'
	| 'brand_approval'
	| 'recipient_list';

type Request = Doc<'purchaseRequests'>;
type Extraction = Pick<
	Doc<'extractions'>,
	'fileId' | 'status' | 'vendor' | 'totalAmount' | 'receiptDate' | 'items'
>;
type ExtractedField = NonNullable<Doc<'extractions'>['vendor']>;
type ReceiptFacts = { vendor: string; totalAmount: string; receiptDate: string; items: string[] };

const singleSlotFields = {
	second_approval: 'secondApprovalFileId',
	publicity: 'publicityFileId',
	catering_waiver: 'cateringWaiverFileId',
	printing_invoice: 'printingInvoiceFileId',
	building_manager_approval: 'buildingManagerApprovalFileId',
	computer_price_quote: 'computerPriceQuoteFileId',
	brand_approval: 'brandApprovalFileId'
} as const;

type SingleSlot = keyof typeof singleSlotFields;
type SingleSlotField = (typeof singleSlotFields)[SingleSlot];

export function requestDocuments(request: Request): { fileId: Id<'files'>; slot: Slot }[] {
	const documents: { fileId: Id<'files'>; slot: Slot }[] = request.receiptFileIds.map((fileId) => ({
		fileId,
		slot: 'receipt'
	}));
	for (const [slot, field] of Object.entries(singleSlotFields) as [SingleSlot, SingleSlotField][]) {
		const fileId = request[field];
		if (fileId !== null) documents.push({ fileId, slot });
	}
	return documents;
}

export function slotOf(request: Request, fileId: Id<'files'>) {
	return requestDocuments(request).find((document) => document.fileId === fileId)?.slot ?? null;
}

export function placeDocument(request: Request, fileId: Id<'files'>, slot: Slot): Partial<Request> {
	if (slot === 'recipient_list') throw new Error('Recipient lists cannot be attached yet.');
	const patch = detachDocument(request, fileId);
	if (slot === 'receipt') {
		patch.receiptFileIds = [...(patch.receiptFileIds ?? request.receiptFileIds), fileId];
		return patch;
	}
	return { ...patch, [singleSlotFields[slot]]: fileId };
}

export function detachDocument(request: Request, fileId: Id<'files'>): Partial<Request> {
	const patch: Partial<Request> = {};
	if (request.receiptFileIds.includes(fileId)) {
		patch.receiptFileIds = request.receiptFileIds.filter((id) => id !== fileId);
	}
	for (const field of Object.values(singleSlotFields)) {
		if (request[field] === fileId) patch[field] = null;
	}
	return patch;
}

export function slotForKind(kind: DocumentKind, looksLikePurchase: boolean): Slot | null {
	if (kind === 'other') return looksLikePurchase ? 'receipt' : null;
	return kind;
}

export function receiptExtractions<E extends Extraction>(request: Request, extractions: E[]) {
	return request.receiptFileIds
		.map((fileId) => extractions.find((row) => row.fileId === fileId && row.status === 'done'))
		.filter((row): row is E => row !== undefined);
}

function factsOf(extraction: Extraction): ReceiptFacts {
	return {
		vendor: extraction.vendor?.value ?? '',
		totalAmount: extraction.totalAmount?.value ?? '',
		receiptDate: extraction.receiptDate?.value ?? '',
		items: extraction.items
	};
}

function combineVendor(receipts: ReceiptFacts[]) {
	const vendors: string[] = [];
	for (const receipt of receipts) {
		const vendor = receipt.vendor.trim();
		if (vendor === '') continue;
		if (!vendors.some((existing) => existing.toLowerCase() === vendor.toLowerCase())) {
			vendors.push(vendor);
		}
	}
	return vendors.join(', ');
}

function combineTotal(receipts: ReceiptFacts[]) {
	const amounts = receipts
		.map((receipt) => Number(receipt.totalAmount))
		.filter((amount) => Number.isFinite(amount) && amount > 0);
	if (amounts.length === 0) return '';
	return (Math.round(amounts.reduce((sum, amount) => sum + amount, 0) * 100) / 100).toFixed(2);
}

function combineDate(receipts: ReceiptFacts[]) {
	const dates = receipts.map((receipt) => receipt.receiptDate).filter((date) => date !== '');
	return dates.sort()[0] ?? '';
}

const combiners: Record<ExtractedReviewField, (receipts: ReceiptFacts[]) => string> = {
	vendor: combineVendor,
	totalAmount: combineTotal,
	receiptDate: combineDate
};

export function receiptFieldsPatch(request: Request, extractions: Extraction[]): Partial<Request> {
	const receipts = receiptExtractions(request, extractions).map(factsOf);
	const sources: FieldSources = { ...(request.fieldSources ?? {}) };
	const patch: Partial<Request> = {};
	const vendor = combineVendor(receipts);
	const total = combineTotal(receipts);
	const receiptDate = combineDate(receipts);
	const itemDescription = describeItems(receipts.flatMap((receipt) => receipt.items));

	const fill = <K extends 'vendor' | 'itemDescription'>(field: K, value: string) => {
		if (sources[field] === 'user') return;
		if (value !== '') {
			if (request[field] !== value) patch[field] = value;
			sources[field] = 'receipt';
		} else if (sources[field] === 'receipt') {
			patch[field] = '';
			delete sources[field];
		}
	};
	fill('vendor', vendor);
	fill('itemDescription', itemDescription);

	if (sources.totalAmount !== 'user') {
		if (total !== '') {
			if (request.totalAmount !== Number(total)) patch.totalAmount = Number(total);
			sources.totalAmount = 'receipt';
		} else if (sources.totalAmount === 'receipt') {
			patch.totalAmount = 0;
			delete sources.totalAmount;
		}
	}

	const previousReceiptDate = request.receiptDate ?? '';
	if (sources.receiptDate !== 'user') {
		if (receiptDate !== '') {
			if (previousReceiptDate !== receiptDate) patch.receiptDate = receiptDate;
			sources.receiptDate = 'receipt';
		} else if (sources.receiptDate === 'receipt') {
			patch.receiptDate = undefined;
			delete sources.receiptDate;
		}
	}

	const nextReceiptDate = 'receiptDate' in patch ? (patch.receiptDate ?? '') : previousReceiptDate;
	const activityDate = request.activityDate ?? '';
	const followsReceipt =
		activityDate === '' ||
		(sources.activityDate === 'receipt' && activityDate === previousReceiptDate);
	if (sources.activityDate !== 'user' && followsReceipt && activityDate !== nextReceiptDate) {
		patch.activityDate = nextReceiptDate;
		if (nextReceiptDate === '') delete sources.activityDate;
		else sources.activityDate = 'receipt';
	}

	if (JSON.stringify(sources) !== JSON.stringify(request.fieldSources ?? {})) {
		patch.fieldSources = sources;
	}
	return patch;
}

export type Review = {
	field: ReviewField;
	value: string;
	alternatives: string[];
	receiptRemoved?: boolean;
};

export function requestReviews(request: Request, extractions: Extraction[]): Review[] {
	const receipts = receiptExtractions(request, extractions);
	const sources = request.fieldSources ?? {};
	const reviews: Review[] = [];
	for (const field of ['vendor', 'totalAmount', 'receiptDate'] as const) {
		if (sources[field] === 'user') continue;
		const facts = receipts.map(factsOf);
		const value = currentValue(request, field);
		const alternatives: string[] = [];
		receipts.forEach((row, index) => {
			const extracted: ExtractedField | null = row[field];
			if (extracted === null || extracted.confident) return;
			for (const alternative of extracted.alternatives) {
				const swapped = facts.map((fact, position) =>
					position === index ? { ...fact, [field]: alternative } : fact
				);
				const combined = combiners[field](swapped);
				if (combined === '' || combined === value || alternatives.includes(combined)) continue;
				alternatives.push(combined);
			}
		});
		const unsure = receipts.some((row) => row[field] !== null && !row[field].confident);
		if (!unsure || (value === '' && alternatives.length === 0)) continue;
		reviews.push({ field, value, alternatives: alternatives.slice(0, 3) });
	}
	const suggestions: Record<CheckField, string> = {
		vendor: combineVendor(receipts.map(factsOf)),
		itemDescription: describeItems(receipts.flatMap((row) => row.items))
	};
	for (const check of activeReceiptChecks(request)) {
		const suggestion = suggestions[check.field];
		const alternatives = suggestion === '' || suggestion === check.value ? [] : [suggestion];
		reviews.push({ field: check.field, value: check.value, alternatives, receiptRemoved: true });
	}
	return reviews;
}

export function activeReceiptChecks(request: Request): ReceiptCheck[] {
	const sources = request.fieldSources ?? {};
	return (request.receiptChecks ?? []).filter(
		(check) =>
			sources[check.field] === 'user' &&
			request[check.field] === check.value &&
			check.value.trim() !== ''
	);
}

export function receiptRemovalChecks(request: Request): ReceiptCheck[] {
	const sources = request.fieldSources ?? {};
	const checks = activeReceiptChecks(request);
	for (const field of ['vendor', 'itemDescription'] as const) {
		const value = request[field];
		if (sources[field] !== 'user' || value.trim() === '') continue;
		if (checks.some((check) => check.field === field)) continue;
		checks.push({ field, value });
	}
	return checks;
}

function currentValue(request: Request, field: ExtractedReviewField) {
	if (field === 'totalAmount') return request.totalAmount > 0 ? request.totalAmount.toFixed(2) : '';
	if (field === 'receiptDate') return request.receiptDate ?? '';
	return request.vendor;
}

export function resolveReviewPatch(
	request: Request,
	field: ReviewField,
	value: string
): Partial<Request> {
	const sources: FieldSources = { ...(request.fieldSources ?? {}), [field]: 'user' };
	const text = value.trim();
	if (field === 'vendor' || field === 'itemDescription') {
		if (text === '') throw new Error(field === 'vendor' ? 'Vendor missing.' : 'Items missing.');
		const checks = request.receiptChecks ?? [];
		return {
			[field]: text,
			fieldSources: sources,
			...(checks.length === 0
				? {}
				: { receiptChecks: checks.filter((check) => check.field !== field) })
		};
	}
	if (field === 'totalAmount') {
		const amount = Number(text.replace(/[$,\s]/g, ''));
		if (!Number.isFinite(amount) || amount <= 0) throw new Error('Total amount must be positive.');
		return { totalAmount: Math.round(amount * 100) / 100, fieldSources: sources };
	}
	if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('Receipt date must be YYYY-MM-DD.');
	const patch: Partial<Request> = { receiptDate: text, fieldSources: sources };
	const activityDate = request.activityDate ?? '';
	if (
		sources.activityDate !== 'user' &&
		(activityDate === '' || activityDate === (request.receiptDate ?? ''))
	) {
		patch.activityDate = text;
		sources.activityDate = 'receipt';
	}
	return patch;
}

export function isCurrentAttempt(
	extraction: Pick<Doc<'extractions'>, 'attempt'>,
	attempt: number | undefined
) {
	return (extraction.attempt ?? 0) === (attempt ?? 0);
}

export function documentReadFailed(
	slot: Slot,
	extraction: Pick<
		Doc<'extractions'>,
		'status' | 'vendor' | 'totalAmount' | 'receiptDate' | 'items'
	> | null
) {
	if (extraction === null) return false;
	if (extraction.status === 'failed') return true;
	if (slot !== 'receipt' || extraction.status !== 'done') return false;
	return (
		extraction.vendor === null &&
		extraction.totalAmount === null &&
		extraction.receiptDate === null &&
		extraction.items.length === 0
	);
}
