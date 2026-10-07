import type { FieldSource, FormState } from './editor.svelte';
import {
	checkStep,
	checkStepTitles,
	idCardTitle,
	reasonStep,
	sentBackStep,
	stepOrder,
	type RequestCheck,
	type RequestView,
	type StepId
} from '../../../../../convex/requestView';
import { formatEventTime } from '../../../../../convex/events';
import { requiresRecipients } from '../../../../../convex/businessPurpose';
import { categoryList, formatMoney, shiftDate, shortDate } from './labels';

export type StepState = 'done' | 'check' | 'current' | 'todo';

export type Step = {
	id: StepId;
	state: StepState;
	title: string;
	summary: string;
	blockingReasons: string[];
	checks: RequestCheck[];
};

export type StepContext = {
	reviewCount: number;
	sourceOf: (field: string) => FieldSource | undefined;
	keep?: ReadonlySet<StepId>;
};

type Draft = Pick<
	FormState,
	| 'documentationCategories'
	| 'purchaserSource'
	| 'purchaser'
	| 'activity'
	| 'vendor'
	| 'itemDescription'
	| 'totalAmount'
	| 'budgetLineItem'
	| 'receiptFileIds'
	| 'secondApprovalFileId'
	| 'publicityFileId'
	| 'cateringWaiverFileId'
	| 'printingInvoiceFileId'
	| 'brandApprovalFileId'
	| 'buildingManagerApprovalFileId'
	| 'computerPriceQuoteFileId'
	| 'officeLocation'
	| 'recipients'
>;

const doneTitles: Record<StepId, string> = {
	receipt: 'Receipt',
	categories: 'What it includes',
	event: 'Event',
	purchaser: 'Who paid',
	idCard: 'UO ID',
	packaging: 'Snacks',
	cateringWaiver: 'Catering Waiver',
	recipients: 'Recipients',
	officeLocation: 'Where it’s kept',
	publicity: 'Publicity Proof',
	secondApproval: 'Second Approval',
	otherDocs: 'Other documents',
	review: 'Review and fill'
};

export function hasFile(id: string | null | undefined) {
	return id !== null && id !== undefined && id.trim() !== '';
}

export function effectiveCategories(
	draft: Pick<Draft, 'documentationCategories'>,
	fundLetter: string
) {
	const categories = new Set(draft.documentationCategories);
	if (fundLetter === 'I') categories.add('asuo_funds');
	return [...categories];
}

function receiptSummary(draft: Draft, receiptDate: string) {
	const money = formatMoney(draft.totalAmount);
	const parts = [
		money,
		draft.vendor ? `at ${draft.vendor}` : '',
		receiptDate ? `on ${shortDate(receiptDate)}` : ''
	].filter(Boolean);
	const bought = parts.join(' ');
	const line = draft.budgetLineItem ? `charged to ${draft.budgetLineItem}` : '';
	return [bought, line].filter(Boolean).join(', ');
}

function eventSummary(activity: Draft['activity']) {
	return [
		activity.name,
		activity.dates.map(shortDate).join(', '),
		formatEventTime(activity.time),
		activity.location,
		activity.attendance === null ? '' : `about ${activity.attendance} students`,
		activity.name && activity.openToAllStudents ? 'open to all' : ''
	]
		.filter((part) => part.trim() !== '')
		.join(', ');
}

export function requestSteps(
	view: Pick<RequestView, 'readiness' | 'checks' | 'documents' | 'purchase'>,
	draft: Draft,
	context: StepContext
): Step[] {
	const self = draft.purchaserSource.kind === 'self';
	const fundLetter = view.purchase.studentOrganization.fundLetter;
	const categories = effectiveCategories(draft, fundLetter);
	const checkTitles = new Set(view.checks.map((check) => check.title));
	const blocking = new Map<StepId, string[]>();
	for (const section of view.readiness.sections) {
		for (const reason of section.reasons) {
			if (checkTitles.has(reason)) continue;
			const { step, title } = reasonStep(section.section, reason);
			const titles = blocking.get(step) ?? [];
			if (!titles.includes(title)) blocking.set(step, [...titles, title]);
		}
	}
	const checksFor = new Map<StepId, RequestCheck[]>();
	for (const check of view.checks) {
		const step = checkStep(check);
		checksFor.set(step, [...(checksFor.get(step) ?? []), check]);
	}
	for (const [step, checks] of checksFor) {
		const titles = checks.filter((check) => check.severity === 'blocking').map((c) => c.title);
		if (titles.length > 0) blocking.set(step, [...titles, ...(blocking.get(step) ?? [])]);
	}
	const gaps: [StepId, boolean, string, string][] = [
		['recipients', draft.recipients.length === 0, 'Recipients', 'Recipient missing.'],
		[
			'officeLocation',
			draft.officeLocation.trim() === '',
			'Purchase details',
			'Office location missing.'
		],
		['publicity', !hasFile(draft.publicityFileId), 'Files', 'Publicity proof missing.'],
		[
			'otherDocs',
			categories.includes('printing_services') && !hasFile(draft.printingInvoiceFileId),
			'Files',
			'Printing invoice missing.'
		]
	];
	for (const [step, missing, section, reason] of gaps) {
		if (missing && !blocking.has(step)) blocking.set(step, [reasonStep(section, reason).title]);
	}
	const filename = (id: string | null) =>
		view.documents.find((document) => document.fileId === id)?.filename ?? '';
	const packaged = view.purchase.foodIndividuallyPackaged ?? null;
	const idMissing =
		!hasFile(draft.purchaser.idCardFrontFileId) || !hasFile(draft.purchaser.idCardBackFileId);
	const receiptDate = view.purchase.receiptDate ?? '';
	const firstDate = [...draft.activity.dates].sort()[0];
	const publicBy = firstDate === undefined ? null : shiftDate(firstDate, -7);

	const applies: Record<StepId, boolean> = {
		receipt: true,
		categories: true,
		event: true,
		purchaser: true,
		idCard: idMissing || blocking.has('idCard') || (context.keep?.has('idCard') ?? false),
		packaging: checksFor.get('packaging') !== undefined || packaged !== null,
		cateringWaiver:
			checksFor.get('cateringWaiver') !== undefined || hasFile(draft.cateringWaiverFileId),
		recipients: requiresRecipients(categories),
		officeLocation: categories.includes('office_supplies_goods'),
		publicity: categories.includes('asuo_funds'),
		secondApproval: self,
		otherDocs:
			categories.includes('printing_services') ||
			categories.includes('office_supplies_goods') ||
			categories.includes('merchandise_apparel'),
		review: true
	};

	const needsCheck: Partial<Record<StepId, boolean>> = {
		receipt: context.reviewCount > 0,
		categories: context.sourceOf('documentationCategories') !== 'user',
		event: isDefault(context.sourceOf('activity')),
		purchaser: !self && isDefault(context.sourceOf('purchaserSource'))
	};

	const summaries: Record<StepId, () => string> = {
		receipt: () =>
			draft.receiptFileIds.length === 0
				? 'A photo or PDF of what you bought'
				: receiptSummary(draft, receiptDate) || 'Reading the receipt',
		categories: () =>
			categoryList(
				categories.filter((category) => category !== 'asuo_funds' || fundLetter !== 'I')
			).join(', ') || 'Nothing special',
		event: () => eventSummary(draft.activity) || 'Which event it was for, when and where',
		purchaser: () => (self ? `You, ${draft.purchaser.name}` : draft.purchaser.name),
		idCard: () =>
			idMissing
				? `Engage needs both sides of ${self ? 'your' : 'their'} UO ID card for a reimbursement`
				: 'Front and back on file',
		packaging: () =>
			packaged === null
				? 'Sealed single-serving snacks and canned drinks don’t need a catering waiver'
				: packaged
					? 'All sealed. No waiver needed'
					: 'Some were shared. Needs a catering waiver',
		cateringWaiver: () =>
			filename(draft.cateringWaiverFileId) || 'A signed waiver from University Catering',
		recipients: () =>
			draft.recipients
				.map((recipient) => recipient.name.trim())
				.filter(Boolean)
				.join(', ') || 'Who got each gift or prize, with their 95#',
		officeLocation: () => draft.officeLocation || 'The office or room where the supplies are kept',
		publicity: () =>
			filename(draft.publicityFileId) ||
			(publicBy === null
				? 'A post or flyer that went out a week before'
				: `A post or flyer that went out by ${shortDate(publicBy)}`),
		secondApproval: () =>
			filename(draft.secondApprovalFileId) || 'You paid, so another officer approves it',
		otherDocs: () =>
			[
				draft.printingInvoiceFileId,
				draft.brandApprovalFileId,
				draft.buildingManagerApprovalFileId,
				draft.computerPriceQuoteFileId
			]
				.map(filename)
				.filter(Boolean)
				.join(', ') || otherDocsHint(categories),
		review: () => 'Check the Business Purpose, then fill Engage'
	};

	const steps: Step[] = stepOrder
		.filter((id) => applies[id])
		.map((id) => {
			const reasons = blocking.get(id) ?? [];
			const checks = checksFor.get(id) ?? [];
			const confirm = checks.find(
				(check) => check.severity === 'warning' && check.action === 'confirm'
			);
			const prompt = needsCheck[id] ? checkStepTitles[id] : confirm?.title;
			const state: StepState =
				id === 'review' || reasons.length > 0 ? 'todo' : prompt !== undefined ? 'check' : 'done';
			return {
				id,
				state,
				title: state === 'done' ? doneTitles[id] : titleFor(id, reasons, prompt, packaged, self),
				summary: summaries[id](),
				blockingReasons: reasons,
				checks
			};
		});
	const current = steps.find((step) => step.state !== 'done');
	if (current !== undefined) {
		current.state = 'current';
		if (current.id === 'review' && current.blockingReasons.length === 0) {
			current.title = view.purchase.reviewerNote != null ? sentBackStep : 'Business Purpose';
		}
	}
	return steps;
}

function titleFor(
	id: StepId,
	reasons: string[],
	prompt: string | undefined,
	packaged: boolean | null,
	self: boolean
) {
	if (reasons[0] !== undefined) return reasons[0];
	if (id === 'idCard') return idCardTitle(self);
	if (id === 'packaging' && packaged === null) return 'Were all the snacks individually packaged?';
	return prompt ?? doneTitles[id];
}

function isDefault(source: FieldSource | undefined) {
	return source === 'previous' || source === 'suggested';
}

function otherDocsHint(categories: string[]) {
	if (categories.includes('printing_services')) return 'The invoice from the printer';
	return 'Only if Engage asks for them';
}

export function stepsLeft(steps: Step[]) {
	return steps.filter((step) => step.state !== 'done').length;
}

export function involves(draft: Pick<Draft, 'documentationCategories'>, fundLetter: string) {
	return categoryList(effectiveCategories(draft, fundLetter));
}

export type RequestMode = 'closed' | 'reading' | 'steps' | 'ready';

export function requestMode(input: {
	closed: boolean;
	reading: boolean;
	ready: boolean;
	steps: Step[];
}): RequestMode {
	if (input.closed) return 'closed';
	if (input.reading) return 'reading';
	const current = input.steps.find((step) => step.state === 'current');
	return input.ready && (current === undefined || current.id === 'review') ? 'ready' : 'steps';
}
