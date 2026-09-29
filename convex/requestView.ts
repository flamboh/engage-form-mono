import { z } from 'zod/v4';
import { zid } from 'convex-helpers/server/zod4';
import { fileKind, purchaseRequestDoc } from './purchaseZod';

export const documentSlot = z.enum([
	'receipt',
	'second_approval',
	'publicity',
	'catering_waiver',
	'printing_invoice',
	'building_manager_approval',
	'computer_price_quote',
	'brand_approval',
	'recipient_list'
]);

export const reviewField = z.enum(['vendor', 'totalAmount', 'receiptDate', 'itemDescription']);

export const requestDocument = z.object({
	fileId: zid('files'),
	kind: fileKind,
	filename: z.string(),
	contentType: z.string(),
	previewUrl: z.string().nullable(),
	reading: z.boolean(),
	readFailed: z.boolean()
});

export const requestReview = z.object({
	field: reviewField,
	value: z.string(),
	alternatives: z.array(z.string()),
	receiptRemoved: z.boolean().optional()
});

export const missingFact = z.enum([
	'vendor',
	'items',
	'total',
	'purchaser',
	'eventName',
	'dates',
	'time',
	'location',
	'attendance',
	'recipients'
]);

export const requestCheck = z.object({
	id: z.string(),
	severity: z.enum(['blocking', 'warning']),
	title: z.string(),
	detail: z.string(),
	fileId: zid('files').nullable(),
	slot: documentSlot.nullable(),
	action: z.enum(['upload', 'answer', 'confirm']).nullable()
});

export const stage = z.enum(['reading', 'after_event', 'to_finish', 'ready', 'filled', 'approved']);

export const requestView = z.object({
	purchase: purchaseRequestDoc,
	documents: z.array(requestDocument),
	reading: z.boolean(),
	reviews: z.array(requestReview),
	readiness: z.object({
		ready: z.boolean(),
		sections: z.array(z.object({ section: z.string(), reasons: z.array(z.string()) }))
	}),
	businessPurposeText: z.string(),
	businessPurposeMissing: z.array(z.object({ fact: missingFact, label: z.string() })),
	checks: z.array(requestCheck),
	stage,
	finishAfter: z.string().nullable(),
	deadline: z.string().nullable(),
	daysLeft: z.number().nullable()
});

export type RequestView = z.infer<typeof requestView>;
export type RequestDocument = z.infer<typeof requestDocument>;
export type RequestReview = z.infer<typeof requestReview>;
export type DocumentSlot = z.infer<typeof documentSlot>;
export type RequestCheck = z.infer<typeof requestCheck>;

export type StepId =
	| 'receipt'
	| 'event'
	| 'purchaser'
	| 'idCard'
	| 'packaging'
	| 'cateringWaiver'
	| 'recipients'
	| 'officeLocation'
	| 'publicity'
	| 'secondApproval'
	| 'otherDocs'
	| 'review';

export const stepOrder: StepId[] = [
	'receipt',
	'event',
	'purchaser',
	'idCard',
	'packaging',
	'cateringWaiver',
	'recipients',
	'officeLocation',
	'publicity',
	'secondApproval',
	'otherDocs',
	'review'
];

export const sentBackStep = 'Fix what Engage sent back';

const reasonSteps: [RegExp, StepId, string][] = [
	[/^Your UO ID/, 'idCard', 'Add your UO ID (front and back)'],
	[/^Purchaser UO ID/, 'idCard', 'Add their UO ID (front and back)'],
	[/^Receipt document missing/, 'receipt', 'Add a receipt'],
	[/^Receipt documents are limited/, 'receipt', 'Keep it to three receipts'],
	[/^Vendor missing/, 'receipt', 'Add where it was bought'],
	[/^Item description missing/, 'receipt', 'Say what was bought'],
	[/^Total amount/, 'receipt', 'Add the total'],
	[/^Budget line item missing/, 'receipt', 'Pick a budget line'],
	[/^Purchaser profile must belong/, 'purchaser', 'Choose who paid again'],
	[/^Purchaser/, 'purchaser', 'Finish who paid'],
	[/^Recipient/, 'recipients', 'Add who received it'],
	[/^Office location missing/, 'officeLocation', 'Add where it will be kept'],
	[/^Publicity proof missing/, 'publicity', 'Add proof the event was advertised'],
	[/^Second approval missing/, 'secondApproval', 'Add a second approval'],
	[/^Printing invoice missing/, 'otherDocs', 'Add the printing invoice'],
	[/^Business purpose/, 'review', 'Say what it was for'],
	[/^Reimbursement reason/, 'review', 'Add a reimbursement reason'],
	[/^Requester/, 'review', 'Finish your profile'],
	[
		/^(Student organization|Index number|Budget line missing)/,
		'review',
		'Finish the organization details'
	],
	[/^Type of Purchase/, 'review', 'Only reimbursements are supported']
];

export function idCardTitle(self: boolean) {
	return self ? 'Add your UO ID (front and back)' : 'Add their UO ID (front and back)';
}

export function reasonStep(section: string, reason: string): { step: StepId; title: string } {
	if (section === 'Event') return { step: 'event', title: reason.replace(/\.$/, '') };
	const match = reasonSteps.find(([pattern]) => pattern.test(reason));
	if (match === undefined) return { step: 'review', title: reason.replace(/\.$/, '') };
	return { step: match[1], title: match[2] };
}

export function checkStep(check: Pick<RequestCheck, 'action' | 'slot'>): StepId {
	if (check.action === 'answer') return 'packaging';
	if (check.slot === null) return 'recipients';
	if (check.slot === 'receipt') return 'receipt';
	if (check.slot === 'publicity') return 'publicity';
	if (check.slot === 'second_approval') return 'secondApproval';
	if (check.slot === 'catering_waiver') return 'cateringWaiver';
	return 'otherDocs';
}
