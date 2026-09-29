import type { RequestCheck } from '$convex/requestView';
import { reviewDisplay } from './labels';

export type LeftTarget =
	| { kind: 'slot'; slot: MissingSlot }
	| { kind: 'check'; check: RequestCheck }
	| { kind: 'field'; field: LeftField }
	| { kind: 'review'; field: ReviewField }
	| { kind: 'link'; href: string };

export type MissingSlot =
	| 'receipt'
	| 'publicity'
	| 'second_approval'
	| 'catering_waiver'
	| 'printing_invoice';
export type ReviewField = 'vendor' | 'totalAmount' | 'receiptDate' | 'itemDescription';
export type LeftField =
	| 'event'
	| 'dates'
	| 'time'
	| 'location'
	| 'attendance'
	| 'why'
	| 'purchaser'
	| 'budget'
	| 'recipients'
	| 'vendor'
	| 'itemDescription'
	| 'totalAmount'
	| 'officeLocation'
	| 'businessPurpose'
	| 'documents'
	| 'details';

export type LeftItem = {
	key: string;
	label: string;
	detail: string;
	target: LeftTarget;
	blocking: boolean;
	waitsForReceipt: boolean;
};

type Copy = Omit<LeftItem, 'blocking'>;

const reasonCopy: Record<string, Copy> = {
	'Choose the event.': {
		key: 'event',
		label: 'Which event was it for?',
		detail: 'Pick a saved event or add a new one.',
		target: { kind: 'field', field: 'event' },
		waitsForReceipt: false
	},
	'Add the event date.': {
		key: 'dates',
		label: 'When was the event?',
		detail: 'Engage wants the date of the event, not just the receipt.',
		target: { kind: 'field', field: 'dates' },
		waitsForReceipt: false
	},
	'Add the event time.': {
		key: 'time',
		label: 'What time did it start?',
		detail: 'Like 6:30pm.',
		target: { kind: 'field', field: 'time' },
		waitsForReceipt: false
	},
	'Add where the event was.': {
		key: 'location',
		label: 'Where was the event?',
		detail: 'The building and room, like McKenzie 240A.',
		target: { kind: 'field', field: 'location' },
		waitsForReceipt: false
	},
	'Add how many students attended.': {
		key: 'attendance',
		label: 'About how many students came?',
		detail: 'A rough count is fine.',
		target: { kind: 'field', field: 'attendance' },
		waitsForReceipt: false
	},
	'Receipt document missing.': {
		key: 'receipt',
		label: 'Add the receipt',
		detail: 'A photo or PDF of what you bought.',
		target: { kind: 'slot', slot: 'receipt' },
		waitsForReceipt: false
	},
	'Receipt documents are limited to three.': {
		key: 'receipt-limit',
		label: 'Keep it to three receipts',
		detail: 'Engage accepts up to three receipt documents.',
		target: { kind: 'slot', slot: 'receipt' },
		waitsForReceipt: false
	},
	'Publicity proof missing.': {
		key: 'publicity',
		label: 'Add Publicity Proof',
		detail: 'A post, flyer, or calendar listing shared at least a week before the event.',
		target: { kind: 'slot', slot: 'publicity' },
		waitsForReceipt: false
	},
	'Second approval missing.': {
		key: 'second_approval',
		label: 'Add a Second Approval',
		detail: 'You paid, so another officer OKs it by email. We’ll write it for you.',
		target: { kind: 'slot', slot: 'second_approval' },
		waitsForReceipt: false
	},
	'Printing invoice missing.': {
		key: 'printing_invoice',
		label: 'Add the printing invoice',
		detail: 'Needed because this purchase includes printing.',
		target: { kind: 'slot', slot: 'printing_invoice' },
		waitsForReceipt: false
	},
	'Vendor missing.': {
		key: 'vendor',
		label: 'Where was it bought?',
		detail: 'The store or website on the receipt.',
		target: { kind: 'field', field: 'vendor' },
		waitsForReceipt: true
	},
	'Item description missing.': {
		key: 'itemDescription',
		label: 'What was bought?',
		detail: 'A short description, like “snacks for general meeting”.',
		target: { kind: 'field', field: 'itemDescription' },
		waitsForReceipt: true
	},
	'Total amount must be greater than zero.': {
		key: 'totalAmount',
		label: 'Enter the total',
		detail: 'The amount you paid, including tax.',
		target: { kind: 'field', field: 'totalAmount' },
		waitsForReceipt: true
	},
	'Budget line item missing.': {
		key: 'budget',
		label: 'Pick a budget line',
		detail: 'Which part of the budget pays for this.',
		target: { kind: 'field', field: 'budget' },
		waitsForReceipt: false
	},
	'Reimbursement reason missing.': {
		key: 'reimbursementReason',
		label: 'Add a reimbursement reason',
		detail: 'Why this was paid personally.',
		target: { kind: 'field', field: 'details' },
		waitsForReceipt: false
	},
	'Office location missing.': {
		key: 'officeLocation',
		label: 'Where will the supplies be kept?',
		detail: 'An office or room on campus.',
		target: { kind: 'field', field: 'officeLocation' },
		waitsForReceipt: false
	},
	'Business purpose missing.': {
		key: 'why',
		label: 'What was it for?',
		detail: 'Pick an event or write a short purpose.',
		target: { kind: 'field', field: 'why' },
		waitsForReceipt: false
	},
	'Business purpose has unresolved variables.': {
		key: 'businessPurpose',
		label: 'Finish the Business Purpose',
		detail: 'A few blanks in the sentence still need values.',
		target: { kind: 'field', field: 'businessPurpose' },
		waitsForReceipt: true
	},
	'Recipient missing.': {
		key: 'recipients',
		label: 'Add who received the items',
		detail: 'Gifts, prizes, and merchandise need each recipient’s name and UO ID.',
		target: { kind: 'field', field: 'recipients' },
		waitsForReceipt: false
	},
	'Type of Purchase is not supported yet.': {
		key: 'typeOfPurchase',
		label: 'Switch to Personal Reimbursement',
		detail: 'Other purchase types are not supported yet.',
		target: { kind: 'field', field: 'details' },
		waitsForReceipt: false
	}
};

const sectionCopy: Record<string, Copy> = {
	Recipients: {
		key: 'recipient-details',
		label: 'Finish recipient details',
		detail: 'Each recipient needs a name, UO ID, and value.',
		target: { kind: 'field', field: 'recipients' },
		waitsForReceipt: false
	},
	Purchaser: {
		key: 'purchaser',
		label: 'Finish the purchaser’s saved details',
		detail: 'Their UO ID number, address, or a photo of either side of their ID card is missing.',
		target: { kind: 'field', field: 'purchaser' },
		waitsForReceipt: false
	},
	Requester: {
		key: 'requester',
		label: 'Finish your profile',
		detail: 'Your name, email, or phone is missing.',
		target: { kind: 'link', href: '/app/saved' },
		waitsForReceipt: false
	},
	'Student organization': {
		key: 'organization',
		label: 'Finish this organization’s setup',
		detail: 'Its name, index number, or budget lines are missing.',
		target: { kind: 'link', href: '/app/saved' },
		waitsForReceipt: false
	}
};

const purposeCopy: Copy = {
	key: 'purpose',
	label: 'What was it for?',
	detail: 'A few words, like “prizes for trivia night”.',
	target: { kind: 'field', field: 'why' },
	waitsForReceipt: false
};

const reviewReasonKey: Record<ReviewField, string | null> = {
	vendor: 'vendor',
	totalAmount: 'totalAmount',
	receiptDate: null,
	itemDescription: 'itemDescription'
};

const reviewCopy: Record<ReviewField, string> = {
	vendor: 'Check the store',
	totalAmount: 'Check the total',
	receiptDate: 'Check the receipt date',
	itemDescription: 'Check the items'
};

export function reviewProposal(review: { value: string; alternatives: string[] }) {
	if (review.value.trim() !== '') return review.value;
	return review.alternatives.find((alternative) => alternative.trim() !== '') ?? '';
}

export function whatsLeft({
	readiness,
	reviews,
	checks = [],
	reading,
	purposeMissing = false,
	onlyPurposeUnresolved = false
}: {
	readiness: { sections: { section: string; reasons: string[] }[] };
	reviews: {
		field: ReviewField;
		value: string;
		alternatives: string[];
		receiptRemoved?: boolean;
	}[];
	checks?: RequestCheck[];
	reading: boolean;
	purposeMissing?: boolean;
	onlyPurposeUnresolved?: boolean;
}): LeftItem[] {
	const items = new Map<string, LeftItem>();
	if (purposeMissing) items.set(purposeCopy.key, { ...purposeCopy, blocking: true });
	for (const section of readiness.sections) {
		for (const reason of section.reasons) {
			if (checks.some((check) => check.title === reason)) continue;
			const copy = reasonCopy[reason] ?? sectionCopy[section.section] ?? fallbackCopy(reason);
			if (copy.key === 'businessPurpose' && purposeMissing && onlyPurposeUnresolved) continue;
			if (!items.has(copy.key)) items.set(copy.key, { ...copy, blocking: true });
		}
	}
	for (const review of reviews) {
		const proposal = reviewProposal(review);
		if (proposal === '') continue;
		const reasonKey = reviewReasonKey[review.field];
		const replaced = reasonKey === null ? undefined : items.get(reasonKey);
		if (reasonKey !== null) items.delete(reasonKey);
		const key = `review-${review.field}`;
		const shown = reviewDisplay(review.field, proposal);
		items.set(key, {
			key,
			label: reviewCopy[review.field],
			detail:
				review.value.trim() === ''
					? `Is it ${shown}?`
					: review.receiptRemoved
						? `You removed a receipt. Is ${shown} still right?`
						: `We read ${shown}.`,
			target: { kind: 'review', field: review.field },
			blocking: replaced !== undefined,
			waitsForReceipt: false
		});
	}
	for (const check of checks) {
		items.set(`check-${check.id}`, {
			key: `check-${check.id}`,
			label: check.title,
			detail: check.detail,
			target: { kind: 'check', check },
			blocking: check.severity === 'blocking',
			waitsForReceipt: false
		});
	}
	return [...items.values()]
		.map((item, index) => ({ item, index }))
		.sort((a, b) => rank(a.item, reading) - rank(b.item, reading) || a.index - b.index)
		.map(({ item }) => item);
}

function rank(item: LeftItem, reading: boolean) {
	if (item.target.kind === 'review') return 0;
	if (item.target.kind === 'check') {
		if (!item.blocking) return 6;
		return item.target.check.action === 'answer' ? 1 : reading ? 3 : 2;
	}
	if (item.target.kind === 'field' && item.target.field === 'why') return 1;
	if (reading) {
		if (item.waitsForReceipt) return 5;
		if (item.target.kind === 'slot') return 3;
		return 1;
	}
	if (item.waitsForReceipt) return 1;
	if (item.target.kind === 'slot') return 2;
	return 3;
}

function fallbackCopy(reason: string): Copy {
	return {
		key: reason,
		label: reason.replace(/\.$/, ''),
		detail: '',
		target: { kind: 'field', field: 'details' },
		waitsForReceipt: false
	};
}
