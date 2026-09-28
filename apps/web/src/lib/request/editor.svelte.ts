import type { Doc, Id } from '$convex/_generated/dataModel';
import type { DocumentSlot, RequestView } from '$convex/requestView';
import {
	formatBusinessPurposeSource,
	savedPurchaserDetails,
	userAsPurchaser,
	type DocumentationCategory,
	type PurchaserDetails,
	type Recipient,
	type SavedData
} from '$lib/purchase/draftDetails';
import { createSingleFlight } from '$lib/singleFlight';
import type { UploadSlot } from '$lib/uploads.svelte';
import type { ReviewField } from './whatsLeft';

export type Purchase = RequestView['purchase'];

export type FormState = {
	typeOfPurchase: Purchase['typeOfPurchase'];
	documentationCategories: DocumentationCategory[];
	purchaserSource: Purchase['purchaserSource'];
	purchaser: PurchaserDetails;
	activityDate: string;
	vendor: string;
	itemDescription: string;
	totalAmount: number | null;
	budgetLineItem: string;
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
};

export type RequestBackend = {
	saveSnapshot(snapshot: FormState): Promise<void>;
	applyTemplate(templateId: Id<'businessPurposeTemplates'>): Promise<void>;
	resolveReview(field: ReviewField, value: string): Promise<void>;
	removeDocument(fileId: Id<'files'>): Promise<void>;
	requestFill(): Promise<{ engageUrl: string }>;
	markApproved(): Promise<void>;
	reopen(): Promise<void>;
	upload(files: File[], slot: UploadSlot): void;
};

export type FillPhase = 'idle' | 'opening' | 'sent';

const textDebounceMs = 450;

export class RequestEditor {
	overrides = $state<Partial<FormState>>({});
	resolved = $state<Partial<Record<ReviewField, string>>>({});
	error = $state('');
	fillPhase = $state<FillPhase>('idle');
	engageUrl = $state('');
	busy = $state(false);

	#getView: () => RequestView | undefined;
	#getUser: () => Doc<'users'> | null;
	#backend: () => RequestBackend;
	#timer: ReturnType<typeof setTimeout> | null = null;
	#saver = createSingleFlight(async () => {
		const state = this.form;
		if (state === null) return;
		await this.#backend().saveSnapshot($state.snapshot(state));
	});

	constructor(
		getView: () => RequestView | undefined,
		getUser: () => Doc<'users'> | null,
		backend: () => RequestBackend
	) {
		this.#getView = getView;
		this.#getUser = getUser;
		this.#backend = backend;
	}

	get view() {
		return this.#getView();
	}

	get purchase() {
		return this.#getView()?.purchase;
	}

	base = $derived.by((): FormState | null => {
		const purchase = this.purchase;
		if (purchase === undefined) return null;
		return {
			typeOfPurchase: purchase.typeOfPurchase,
			documentationCategories: purchase.documentationCategories,
			purchaserSource: purchase.purchaserSource,
			purchaser: purchase.purchaser,
			activityDate: purchase.activityDate,
			vendor: purchase.vendor,
			itemDescription: purchase.itemDescription,
			totalAmount: purchase.totalAmount || null,
			budgetLineItem: purchase.budgetLineItem,
			businessPurposeText: formatBusinessPurposeSource(purchase.businessPurposeSource),
			businessPurposeTouched: purchase.businessPurposeTouched,
			receiptFileIds: purchase.receiptFileIds,
			secondApprovalFileId: purchase.secondApprovalFileId,
			publicityFileId: purchase.publicityFileId,
			cateringWaiverFileId: purchase.cateringWaiverFileId,
			printingInvoiceFileId: purchase.printingInvoiceFileId,
			brandApprovalFileId: purchase.brandApprovalFileId,
			officeLocation: purchase.officeLocation,
			buildingManagerApprovalFileId: purchase.buildingManagerApprovalFileId,
			computerPriceQuoteFileId: purchase.computerPriceQuoteFileId,
			recipients: purchase.recipients
		};
	});

	form = $derived.by((): FormState | null => {
		if (this.base === null) return null;
		return { ...this.base, ...this.overrides };
	});

	reviews = $derived(
		(this.view?.reviews ?? []).filter((review) => this.resolved[review.field] === undefined)
	);

	receiptDate = $derived(this.resolved.receiptDate ?? this.purchase?.receiptDate ?? '');

	update(patch: Partial<FormState>, options: { debounce?: boolean } = {}) {
		this.overrides = { ...this.overrides, ...patch };
		this.error = '';
		if (this.#timer !== null) clearTimeout(this.#timer);
		this.#timer = null;
		if (options.debounce) {
			this.#timer = setTimeout(() => {
				this.#timer = null;
				this.#save();
			}, textDebounceMs);
			return;
		}
		this.#save();
	}

	async flush() {
		if (this.#timer !== null) {
			clearTimeout(this.#timer);
			this.#timer = null;
			this.#save();
		}
		await this.#saver.flush();
	}

	toggleCategory(category: DocumentationCategory, on: boolean) {
		const current = this.form?.documentationCategories ?? [];
		this.update({
			documentationCategories: on
				? [...current.filter((item) => item !== category), category]
				: current.filter((item) => item !== category)
		});
	}

	choosePurchaserSelf() {
		const user = this.#getUser();
		if (user === null) return;
		this.update({ purchaserSource: { kind: 'self' }, purchaser: userAsPurchaser(user) });
	}

	choosePurchaser(purchaser: SavedData['purchasers'][number]) {
		this.update({
			purchaserSource: { kind: 'purchaser', purchaserId: purchaser._id },
			purchaser: savedPurchaserDetails(purchaser)
		});
	}

	async applyTemplate(templateId: Id<'businessPurposeTemplates'>) {
		await this.#run(async () => {
			await this.flush();
			await this.#backend().applyTemplate(templateId);
			const next = { ...this.overrides };
			delete next.businessPurposeText;
			delete next.businessPurposeTouched;
			this.overrides = next;
		});
	}

	async resolveReview(field: ReviewField, value: string) {
		this.resolved = { ...this.resolved, [field]: value };
		if (field === 'vendor') this.overrides = { ...this.overrides, vendor: value };
		if (field === 'totalAmount') {
			this.overrides = { ...this.overrides, totalAmount: parseMoney(value) };
		}
		await this.#run(() => this.#backend().resolveReview(field, value));
	}

	upload(files: File[], slot: UploadSlot) {
		if (files.length === 0) return;
		if (slot === 'auto' || slot === 'receipt') this.resolved = {};
		this.#backend().upload(files, slot);
	}

	async removeDocument(fileId: Id<'files'>) {
		await this.#run(async () => {
			await this.flush();
			const form = this.form;
			if (form !== null) this.overrides = { ...this.overrides, ...withoutFile(form, fileId) };
			await this.#backend().removeDocument(fileId);
			this.overrides = omitFileFields(this.overrides);
		});
	}

	async fill() {
		const tab = window.open('', '_blank');
		if (tab !== null) {
			tab.opener = null;
			tab.document.title = 'Opening Engage';
			tab.document.body.style.font = '16px system-ui, sans-serif';
			tab.document.body.style.padding = '2rem';
			tab.document.body.textContent = 'Opening Engage…';
		}
		this.fillPhase = 'opening';
		this.error = '';
		try {
			await this.flush();
			const { engageUrl } = await this.#backend().requestFill();
			this.engageUrl = engageUrl;
			if (tab !== null) tab.location.href = engageUrl;
			this.fillPhase = 'sent';
		} catch (err) {
			tab?.close();
			this.fillPhase = 'idle';
			this.error = message(err);
		}
	}

	async markApproved() {
		await this.#run(() => this.#backend().markApproved());
	}

	async reopen() {
		this.fillPhase = 'idle';
		await this.#run(() => this.#backend().reopen());
	}

	#save() {
		this.#saver.run().catch((err: unknown) => {
			this.error = message(err);
		});
	}

	async #run(action: () => Promise<void>) {
		this.busy = true;
		this.error = '';
		try {
			await action();
		} catch (err) {
			this.error = message(err);
		} finally {
			this.busy = false;
		}
	}
}

export const slotField: Record<
	Exclude<DocumentSlot, 'receipt' | 'recipient_list'>,
	keyof FormState
> = {
	second_approval: 'secondApprovalFileId',
	publicity: 'publicityFileId',
	catering_waiver: 'cateringWaiverFileId',
	printing_invoice: 'printingInvoiceFileId',
	building_manager_approval: 'buildingManagerApprovalFileId',
	computer_price_quote: 'computerPriceQuoteFileId',
	brand_approval: 'brandApprovalFileId'
};

export function parseMoney(value: string) {
	const amount = Number(value.replace(/[$,\s]/g, ''));
	return value.trim() === '' || Number.isNaN(amount) ? null : amount;
}

function withoutFile(form: FormState, fileId: Id<'files'>): Partial<FormState> {
	const patch: Partial<FormState> = {
		receiptFileIds: form.receiptFileIds.filter((id) => id !== fileId)
	};
	for (const field of Object.values(slotField)) {
		if (form[field] === fileId) Object.assign(patch, { [field]: null });
	}
	return patch;
}

function omitFileFields(overrides: Partial<FormState>) {
	const next = { ...overrides };
	delete next.receiptFileIds;
	for (const field of Object.values(slotField)) delete next[field];
	return next;
}

function message(err: unknown) {
	const text = err instanceof Error ? err.message : String(err);
	return text
		.replace(/^\[CONVEX[^\]]*\]\s*/, '')
		.replace(/^Uncaught Error:\s*/, '')
		.split('\n')[0];
}
