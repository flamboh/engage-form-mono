import type { Id } from '../_generated/dataModel';
import type { DocumentFacts } from '../extraction/facts';
import type { DocumentSlot, RequestCheck } from '../requestView';
import { eventDatesPhrase, formatEventDates } from '../events';
import { sameDay } from './candidates';

export type CheckDocument = {
	fileId: Id<'files'>;
	slot: DocumentSlot;
	vendor: string;
	total: string;
	facts: DocumentFacts | null;
};

export type Confirmation = { id: string; key: string };

export type ApprovalBasis = {
	totalAmount: number;
	vendor: string;
	itemDescription: string;
	activity: { name: string; dates: string[] };
};

export type CheckInput = ApprovalBasis & {
	categories: string[];
	purchaserIsSelf: boolean;
	activity: { name: string; dates: string[]; location: string };
	recipients: { name: string; uo95: string }[];
	foodIndividuallyPackaged: boolean | null;
	cateringWaiverAttached: boolean;
	confirmations: Confirmation[];
	documents: CheckDocument[];
};

const exemptFoodVendor =
	/\b(?:bartolotti'?s?|subway|chipotle|emu|erb memorial union|uo catering|university catering)\b/i;
const exemptFoodLocation = /\b(?:portland|oimb|charleston)\b/i;
const stopWords = new Set([
	'the',
	'and',
	'for',
	'with',
	'from',
	'of',
	'a',
	'an',
	'to',
	'in',
	'on',
	'at',
	'more',
	'event',
	'weekly',
	'club',
	'meeting',
	'night'
]);

export function requestChecks(input: CheckInput): RequestCheck[] {
	const checks = [
		...publicityChecks(input),
		...foodChecks(input),
		...receiptChecks(input),
		...approvalChecks(input),
		...recipientChecks(input)
	];
	return checks
		.map((check, index) => ({ check, index }))
		.sort(
			(left, right) =>
				Number(left.check.severity === 'warning') - Number(right.check.severity === 'warning') ||
				left.index - right.index
		)
		.map(({ check }) => check);
}

export function foodBought(input: Pick<CheckInput, 'categories' | 'documents'>) {
	return (
		input.categories.includes('food') ||
		input.documents.some((document) => document.slot === 'receipt' && document.facts?.food)
	);
}

function publicityChecks(input: CheckInput): RequestCheck[] {
	const publicity = input.documents.find((document) => document.slot === 'publicity');
	if (publicity === undefined || publicity.facts === null) return [];
	const facts = publicity.facts;
	const checks: RequestCheck[] = [];
	const activityDates = input.activity.dates;
	if (activityDates.length > 0) {
		const matches = facts.dates.some((date) => activityDates.some((day) => sameDay(date, day)));
		if (!matches && facts.dates.length > 0) {
			const shown = facts.eventDates[0] ?? facts.dates[0];
			checks.push({
				id: 'publicity-date',
				severity: 'blocking',
				title: 'Publicity shows a different date',
				detail: `It says ${describeDate(shown, activityDates[0])}, but the event was ${eventDatesPhrase(activityDates)}. Add publicity for this date.`,
				fileId: publicity.fileId,
				slot: 'publicity',
				action: 'upload'
			});
		} else if (!matches && !confirmed(input, publicityDateConfirmation(publicity))) {
			checks.push({
				id: 'publicity-date',
				severity: 'warning',
				title: 'Check the date on your publicity',
				detail: `We couldn’t find ${formatEventDates(activityDates)} on it. Reviewers deny publicity for a different date.`,
				fileId: publicity.fileId,
				slot: 'publicity',
				action: 'confirm'
			});
		}
	}
	if (foodBought(input) && !facts.mentionsFood) {
		checks.push({
			id: 'publicity-food',
			severity: 'warning',
			title: 'Publicity doesn’t mention food',
			detail: 'Reviewers want it to say food or snacks were provided.',
			fileId: publicity.fileId,
			slot: 'publicity',
			action: 'upload'
		});
	}
	return checks;
}

function foodChecks(input: CheckInput): RequestCheck[] {
	if (!foodBought(input) || input.cateringWaiverAttached) return [];
	if (exemptFoodVendor.test(input.vendor) || exemptFoodLocation.test(input.activity.location)) {
		return [];
	}
	const waiver = (detail: string): RequestCheck => ({
		id: 'catering-waiver',
		severity: 'blocking',
		title: 'Add the catering waiver',
		detail,
		fileId: null,
		slot: 'catering_waiver',
		action: 'upload'
	});
	if (/\bpizzas?\b/i.test(`${input.vendor} ${input.itemDescription}`)) {
		return [waiver('Pizza needs one unless it came from Bartolotti’s or Subway in the EMU.')];
	}
	if (input.foodIndividuallyPackaged === null) {
		return [
			{
				id: 'food-packaging',
				severity: 'blocking',
				title: 'Were all the snacks individually packaged?',
				detail:
					'Sealed single-serving snacks and canned drinks don’t need a catering waiver. Served food, like coffee or a party tray, does.',
				fileId: null,
				slot: null,
				action: 'answer'
			}
		];
	}
	if (input.foodIndividuallyPackaged) return [];
	return [
		waiver('Food that wasn’t individually packaged needs a waiver from University Catering.')
	];
}

function receiptChecks(input: CheckInput): RequestCheck[] {
	const receipts = input.documents.filter(
		(document): document is CheckDocument & { facts: DocumentFacts } =>
			document.slot === 'receipt' && document.facts !== null
	);
	const covered = (receipt: CheckDocument, has: (facts: DocumentFacts) => boolean) =>
		receipts.some(
			(other) => other.fileId !== receipt.fileId && has(other.facts) && related(receipt, other)
		);
	const checks: RequestCheck[] = [];
	for (const receipt of receipts) {
		const upload = (id: string, title: string, detail: string): RequestCheck => ({
			id: `${id}:${receipt.fileId}`,
			severity: 'warning',
			title,
			detail,
			fileId: receipt.fileId,
			slot: 'receipt',
			action: 'upload'
		});
		if (!receipt.facts.itemized && !covered(receipt, (facts) => facts.itemized)) {
			checks.push(
				upload(
					'receipt-itemized',
					'Add an itemized receipt',
					'This one shows the total but not what was bought. Ask the store for a copy that lists each item.'
				)
			);
		}
		if (
			receipt.facts.cardLast4 === null &&
			!covered(receipt, (facts) => facts.cardLast4 !== null)
		) {
			checks.push(
				upload(
					'receipt-card',
					'Show the last 4 digits of your card',
					'Reviewers need to see the card that paid. Add a receipt or bank statement that shows them.'
				)
			);
		}
		if (receipt.facts.fulfillment === 'pending' && !covered(receipt, shippedOrDelivered)) {
			checks.push(
				upload(
					'receipt-shipped',
					'Add the invoice that shows it shipped',
					'This looks like an order confirmation. Download the invoice once the order has shipped or arrived.'
				)
			);
		}
	}
	return checks;
}

function shippedOrDelivered(facts: DocumentFacts) {
	return facts.fulfillment === 'delivered' || facts.fulfillment === 'shipped';
}

function related(left: CheckDocument, right: CheckDocument) {
	const leftVendor = vendorKey(left.vendor);
	const rightVendor = vendorKey(right.vendor);
	const sameVendor =
		leftVendor.length >= 3 &&
		rightVendor.length >= 3 &&
		(leftVendor.startsWith(rightVendor) || rightVendor.startsWith(leftVendor));
	const sameTotal =
		left.total !== '' &&
		right.total !== '' &&
		Math.abs(Number(left.total) - Number(right.total)) < 0.01;
	return sameVendor || sameTotal;
}

function approvalChecks(input: CheckInput): RequestCheck[] {
	if (!input.purchaserIsSelf) return [];
	const approval = input.documents.find((document) => document.slot === 'second_approval');
	if (approval === undefined || approval.facts === null) return [];
	const facts = approval.facts;
	const text = normalized(facts.text);
	const checks: RequestCheck[] = [];
	const upload = (id: string, severity: RequestCheck['severity'], title: string, detail: string) =>
		checks.push({
			id,
			severity,
			title,
			detail,
			fileId: approval.fileId,
			slot: 'second_approval',
			action: 'upload'
		});
	const approvedTotal = approval.total === '' ? null : Number(approval.total);
	if (
		approvedTotal !== null &&
		input.totalAmount > 0 &&
		Math.abs(approvedTotal - input.totalAmount) >= 0.01
	) {
		upload(
			'approval-total',
			'blocking',
			'Second approval is for a different amount',
			`It approves ${money(approvedTotal)}, but this request is ${money(input.totalAmount)}. Get a new approval for this purchase.`
		);
	}
	const itemWords = significantWords(input.itemDescription);
	if (itemWords.length > 0 && !itemWords.some((word) => text.includes(word))) {
		upload(
			'approval-items',
			'warning',
			'Second approval may be for different items',
			`It doesn’t mention ${input.itemDescription}. Reviewers deny approvals reused from another purchase.`
		);
	}
	const dates = input.activity.dates;
	if (dates.length > 0 || input.activity.name.trim() !== '') {
		const dateMatch = facts.dates.some((date) => dates.some((day) => sameDay(date, day)));
		const nameWords = significantWords(input.activity.name);
		const nameMatch = nameWords.length > 0 && nameWords.every((word) => text.includes(word));
		if (!dateMatch && !nameMatch) {
			const otherDate = facts.eventDates.find((date) => !dates.some((day) => sameDay(date, day)));
			upload(
				'approval-event',
				'warning',
				otherDate !== undefined && dates.length > 0
					? 'Second approval is for a different date'
					: 'Second approval doesn’t name the event',
				otherDate !== undefined && dates.length > 0
					? `It mentions ${describeDate(otherDate, dates[0])}, but the event was ${eventDatesPhrase(dates)}.`
					: `Reviewers want it to say which event and date it’s for${eventPhrase(input)}.`
			);
		}
	}
	const basis = input.confirmations.find((confirmation) => confirmation.id === 'approval-recheck');
	if (
		basis !== undefined &&
		checks.every((check) => check.id !== 'approval-total' && check.id !== 'approval-items') &&
		basisChanged(parseBasis(basis.key), input, approvedTotal !== null)
	) {
		checks.push({
			id: 'approval-recheck',
			severity: 'warning',
			title: 'Recheck the second approval',
			detail: 'The purchase changed after the approval was added. Make sure it still matches.',
			fileId: approval.fileId,
			slot: 'second_approval',
			action: 'confirm'
		});
	}
	return checks;
}

function eventPhrase(input: CheckInput) {
	const name = input.activity.name.trim();
	const dates = input.activity.dates;
	if (name !== '' && dates.length > 0) return `, like “${name} ${eventDatesPhrase(dates)}”`;
	if (name !== '') return `, like “${name}”`;
	return dates.length > 0 ? `, like ${formatEventDates(dates)}` : '';
}

function recipientChecks(input: CheckInput): RequestCheck[] {
	const checks: RequestCheck[] = [];
	input.recipients.forEach((recipient, index) => {
		const id = normalizedUo95(recipient.uo95);
		const name = recipient.name.trim();
		if (id === '') return;
		if (!/^95\d{7}$/.test(id)) {
			checks.push({
				id: `recipient-id:${index}`,
				severity: 'blocking',
				title: `Fix ${name === '' ? 'the recipient' : `${name}’s`} 95#`,
				detail: 'UO IDs are 9 digits and start with 95.',
				fileId: null,
				slot: null,
				action: null
			});
			return;
		}
		if (name === '' || confirmed(input, recipientConfirmation(recipient))) return;
		checks.push({
			id: `recipient-confirm:${index}`,
			severity: 'warning',
			title: `Double-check that ${name}’s 95# is theirs`,
			detail: `${id} — reviewers deny requests when the 95# belongs to someone else.`,
			fileId: null,
			slot: null,
			action: 'confirm'
		});
	});
	return checks;
}

export function confirmationFor(input: CheckInput, checkId: string): Confirmation | null {
	if (checkId === 'approval-recheck') {
		return { id: 'approval-recheck', key: approvalBasisKey(input) };
	}
	if (checkId === 'publicity-date') {
		const publicity = input.documents.find((document) => document.slot === 'publicity');
		return publicity === undefined ? null : publicityDateConfirmation(publicity);
	}
	const recipient = /^recipient-confirm:(\d+)$/.exec(checkId);
	if (recipient !== null) {
		const found = input.recipients[Number(recipient[1])];
		return found === undefined ? null : recipientConfirmation(found);
	}
	return null;
}

export function withConfirmation(confirmations: Confirmation[], confirmation: Confirmation) {
	if (confirmation.id === 'recipient-confirm') {
		return confirmations.some(
			(existing) => existing.id === confirmation.id && existing.key === confirmation.key
		)
			? confirmations
			: [...confirmations, confirmation];
	}
	return [...confirmations.filter((existing) => existing.id !== confirmation.id), confirmation];
}

export function approvalBasisKey(basis: ApprovalBasis) {
	return JSON.stringify({
		totalAmount: basis.totalAmount,
		vendor: basis.vendor.trim(),
		itemDescription: basis.itemDescription.trim(),
		eventName: basis.activity.name.trim(),
		dates: [...basis.activity.dates].sort()
	});
}

type StoredBasis = {
	totalAmount: number;
	vendor: string;
	itemDescription: string;
	eventName: string;
	dates: string[];
};

function parseBasis(key: string): StoredBasis | null {
	try {
		return JSON.parse(key) as StoredBasis;
	} catch {
		return null;
	}
}

function basisChanged(basis: StoredBasis | null, input: CheckInput, totalChecked: boolean) {
	if (basis === null) return false;
	const current = JSON.parse(approvalBasisKey(input)) as StoredBasis;
	const changed = (before: string, after: string) =>
		before !== '' && before.toLowerCase() !== after.toLowerCase();
	return (
		(!totalChecked && basis.totalAmount > 0 && basis.totalAmount !== current.totalAmount) ||
		changed(basis.vendor, current.vendor) ||
		changed(basis.itemDescription, current.itemDescription) ||
		changed(basis.eventName, current.eventName) ||
		(basis.dates.length > 0 && basis.dates.join() !== current.dates.join())
	);
}

function publicityDateConfirmation(publicity: CheckDocument): Confirmation {
	return { id: 'publicity-date', key: publicity.fileId };
}

function recipientConfirmation(recipient: { name: string; uo95: string }): Confirmation {
	return {
		id: 'recipient-confirm',
		key: `${recipient.name.trim().toLowerCase()}|${normalizedUo95(recipient.uo95)}`
	};
}

function confirmed(input: CheckInput, confirmation: Confirmation) {
	return input.confirmations.some(
		(existing) => existing.id === confirmation.id && existing.key === confirmation.key
	);
}

export function normalizedUo95(value: string) {
	return value.replace(/[\s-]/g, '');
}

function significantWords(value: string) {
	return [
		...new Set(
			normalized(value)
				.split(' ')
				.filter((word) => word.length >= 3 && !stopWords.has(word))
				.map((word) => word.replace(/s$/, ''))
		)
	];
}

function normalized(value: string) {
	return value
		.toLowerCase()
		.replace(/[’']/g, '')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

function vendorKey(value: string) {
	return value.toLowerCase().replace(/[^a-z]/g, '');
}

function money(value: number) {
	return `$${value.toFixed(2)}`;
}

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function describeDate(date: string, reference: string | undefined) {
	const iso = date.startsWith('--') ? `${(reference ?? '2000').slice(0, 4)}${date.slice(1)}` : date;
	const parsed = new Date(`${iso}T12:00:00Z`);
	if (Number.isNaN(parsed.getTime())) return date;
	const monthDay = `${iso.slice(5, 7)}/${iso.slice(8, 10)}`;
	return reference === undefined && date.startsWith('--')
		? monthDay
		: `${weekdays[parsed.getUTCDay()]} ${monthDay}`;
}
