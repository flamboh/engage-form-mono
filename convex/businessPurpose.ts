import type { Doc } from './_generated/dataModel';
import { formatEventDates, formatEventTime, joinList, normalizeEventDates } from './events';

export type MissingFact =
	| 'vendor'
	| 'items'
	| 'total'
	| 'purchaser'
	| 'eventName'
	| 'dates'
	| 'time'
	| 'location'
	| 'attendance'
	| 'recipients';

export type BusinessPurposeRecipient = { name: string; uo95: string; reason: string };

export type BusinessPurposeFacts = {
	organization: string;
	purchaser: string;
	vendor: string;
	items: string;
	total: number;
	purpose: string;
	eventName: string;
	dates: string[];
	time: string;
	location: string;
	attendance: number | null;
	openToAllStudents: boolean;
	recipients: BusinessPurposeRecipient[];
	recipientsRequired: boolean;
	today: string | null;
};

export type GeneratedBusinessPurpose = { text: string; missing: MissingFact[] };

export type BusinessPurposeRequest = Pick<
	Doc<'purchaseRequests'>,
	| 'studentOrganization'
	| 'purchaser'
	| 'vendor'
	| 'itemDescription'
	| 'totalAmount'
	| 'purpose'
	| 'activity'
	| 'recipients'
	| 'documentationCategories'
>;

const missingFactLabels: Record<MissingFact, string> = {
	vendor: 'Add the store or vendor',
	items: 'Add what was bought',
	total: 'Add the total',
	purchaser: 'Add who is being reimbursed',
	eventName: 'Choose the event',
	dates: 'Add the event date',
	time: 'Add the event time',
	location: 'Add where the event was',
	attendance: 'Add how many students attended',
	recipients: 'Add each recipient’s name, 95#, and reason'
};

export function missingFactLabel(fact: MissingFact) {
	return missingFactLabels[fact];
}

export function requiresRecipients(categories: readonly string[]) {
	return categories.includes('merchandise_apparel') || categories.includes('gifts_prizes');
}

export function businessPurposeFactsFrom(
	request: BusinessPurposeRequest,
	today: string | null = null
): BusinessPurposeFacts {
	return {
		organization: request.studentOrganization.name,
		purchaser: request.purchaser.name,
		vendor: request.vendor,
		items: request.itemDescription,
		total: request.totalAmount,
		purpose: request.purpose ?? '',
		eventName: request.activity.name,
		dates: request.activity.dates,
		time: request.activity.time,
		location: request.activity.location,
		attendance: request.activity.attendance,
		openToAllStudents: request.activity.openToAllStudents,
		recipients: request.recipients,
		recipientsRequired: requiresRecipients(request.documentationCategories),
		today
	};
}

export function businessPurposeFor(
	request: BusinessPurposeRequest & Pick<Doc<'purchaseRequests'>, 'businessPurposeOverride'>,
	today: string | null = null
) {
	const generated = generateBusinessPurpose(businessPurposeFactsFrom(request, today));
	const override = request.businessPurposeOverride?.trim() ?? '';
	return { ...generated, text: override === '' ? generated.text : override };
}

export function generateBusinessPurpose(facts: BusinessPurposeFacts): GeneratedBusinessPurpose {
	const organization = clean(facts.organization);
	const purchaser = clean(facts.purchaser);
	const vendor = clean(facts.vendor);
	const items = clean(facts.items);
	const total = Number.isFinite(facts.total) && facts.total > 0 ? facts.total : null;
	const eventName = clean(facts.eventName);
	const dates = normalizeEventDates(facts.dates);
	const time = clean(facts.time);
	const location = clean(facts.location);
	const attendance =
		facts.attendance !== null && Number.isFinite(facts.attendance) && facts.attendance > 0
			? Math.round(facts.attendance)
			: null;
	const recipients = facts.recipients
		.map((recipient) => ({
			name: clean(recipient.name),
			uo95: clean(recipient.uo95),
			reason: clean(recipient.reason)
		}))
		.filter((recipient) => recipient.name !== '');

	const missing: MissingFact[] = [];
	if (vendor === '') missing.push('vendor');
	if (items === '') missing.push('items');
	if (total === null) missing.push('total');
	if (purchaser === '') missing.push('purchaser');
	if (eventName === '') missing.push('eventName');
	if (dates.length === 0) missing.push('dates');
	if (time === '') missing.push('time');
	if (location === '') missing.push('location');
	if (attendance === null) missing.push('attendance');
	if (
		(facts.recipientsRequired && recipients.length === 0) ||
		recipients.some((recipient) => recipient.uo95 === '' || recipient.reason === '') ||
		facts.recipients.length > recipients.length
	) {
		missing.push('recipients');
	}

	const itemText = items === '' ? 'items' : midSentence(items);
	const purchase = [
		`purchased ${itemText}`,
		vendor === '' ? '' : ` from ${vendor}`,
		total === null ? '' : ` for ${formatMoney(total)}`
	].join('');
	const opening =
		purchaser === ''
			? `${organization || 'Our student organization'} ${purchase}.`
			: `${organization || 'Our student organization'} wishes to reimburse ${purchaser} because they ${purchase}.`;

	const plural = items !== '' && isPlural(items);
	const upcoming = facts.today !== null && dates.some((date) => date > (facts.today ?? ''));
	const be = upcoming ? 'will be' : plural ? 'were' : 'was';
	const subject = subjectFor(items, plural);
	const use =
		recipients.length > 0
			? `given to ${joinList(recipients.map(recipientText))}`
			: purposeUse(clean(facts.purpose));
	const where = [
		` at ${eventPhrase(organization, eventName)}`,
		dates.length === 0 ? '' : ` on ${formatEventDates(dates)}`,
		time === '' ? '' : ` at ${formatEventTime(time)}`,
		location === '' ? '' : ` ${locationPhrase(location)}`,
		attendance === null
			? ''
			: `, with about ${attendance} ${facts.openToAllStudents ? 'students' : 'members'} ${dates.length > 1 ? 'at each event' : 'in attendance'}`
	].join('');

	return { text: `${opening} ${subject} ${be} ${use}${where}.`, missing };
}

export function customTextOmissions(text: string, facts: BusinessPurposeFacts): MissingFact[] {
	const haystack = text.toLowerCase();
	const omissions: MissingFact[] = [];
	const vendor = clean(facts.vendor).toLowerCase();
	if (vendor !== '' && !haystack.includes(vendor)) omissions.push('vendor');
	if (facts.total > 0) {
		const amount = facts.total.toFixed(2);
		const whole = Number.isInteger(facts.total) ? String(facts.total) : null;
		if (!haystack.includes(amount) && (whole === null || !haystack.includes(`$${whole}`))) {
			omissions.push('total');
		}
	}
	if (facts.attendance !== null && facts.attendance > 0) {
		if (!new RegExp(`\\b${Math.round(facts.attendance)}\\b`).test(haystack)) {
			omissions.push('attendance');
		}
	}
	if (normalizeEventDates(facts.dates).length > 0 && !/\b\d{1,2}\/\d{1,2}\b/.test(haystack)) {
		omissions.push('dates');
	}
	return omissions;
}

function recipientText(recipient: BusinessPurposeRecipient) {
	const id = recipient.uo95 === '' ? '' : ` (${recipient.uo95})`;
	const reason = recipient.reason === '' ? '' : ` ${reasonPhrase(recipient.reason)}`;
	return `${recipient.name}${id}${reason}`;
}

function reasonPhrase(reason: string) {
	const text = midSentence(reason);
	return /^(for|as)\b/i.test(text) ? text : `for ${text}`;
}

function purposeUse(purpose: string) {
	if (purpose === '') return 'used';
	const text = midSentence(purpose).replace(/[.!]+$/, '');
	if (/^(to|as|in|during)\b/i.test(text)) return `used ${text}`;
	return `used for ${text.replace(/^for\s+/i, '')}`;
}

function eventPhrase(organization: string, eventName: string) {
	if (eventName === '')
		return organization === '' ? 'our event' : `${possessive(organization)} event`;
	const named = namedEvent(eventName);
	if (organization === '' || named.toLowerCase().includes(organization.toLowerCase())) {
		return `the ${named}`;
	}
	return `${possessive(organization)} ${named}`;
}

export function eventReference(eventName: string) {
	return `the ${namedEvent(clean(eventName))}`;
}

function namedEvent(eventName: string) {
	const name = midSentence(eventName).replace(/^the\s+/i, '');
	return eventWords.test(name) ? name : `${name} event`;
}

const eventWords =
	/\b(event|events|workshop|session|sessions|night|party|social|show|concert|festival|fair|conference|tournament|meetup|gala|retreat|screening|contest|competition|trip|dinner|lunch|breakfast|potluck|celebration|meeting|club|trivia|game|games|hike|clinic|lecture|talk|panel|performance|recital|drive|sale|market)\b/i;

function locationPhrase(location: string) {
	return /^(in|at|on)\s/i.test(location) ? location : `in ${location}`;
}

function subjectFor(items: string, plural: boolean) {
	if (items === '') return 'The items';
	const bare = midSentence(items)
		.replace(/^(a|an|one|the|this|these|some)\s+/i, '')
		.replace(/^\d+\s+(x\s+)?/i, '');
	const words = bare.split(/\s+/).length;
	if (words <= 5 && !/\bmore$/i.test(bare)) return `The ${bare}`;
	return plural ? 'These items' : 'This item';
}

const singularEndingInS = new Set(['canvas', 'atlas', 'gas', 'lens', 'series', 'news', 'chess']);

function isPlural(items: string) {
	const text = items.trim().toLowerCase();
	if (/,|\band\b|&|\+|\//.test(text)) return true;
	const count = /^(\d+)\s/.exec(text);
	if (count !== null) return Number(count[1]) !== 1;
	if (
		/^(two|three|four|five|six|seven|eight|nine|ten|several|many|multiple|assorted|various|bulk)\b/.test(
			text
		)
	) {
		return true;
	}
	if (/^(a|an|one|this)\s/.test(text)) return false;
	const last =
		text
			.replace(/\s*\(.*\)\s*$/, '')
			.split(/\s+/)
			.at(-1) ?? '';
	const word = last.replace(/[^a-z]/g, '');
	if (singularEndingInS.has(word) || /(ss|us|is)$/.test(word)) return false;
	return /s$/.test(word);
}

export function midSentence(text: string) {
	const words = text.split(/\s+/);
	const [first, ...rest] = words;
	if (first === undefined || !/^[A-Z][a-z'’]+$/.test(first)) return text;
	if (rest.some((word) => /[A-Z]/.test(word))) return text;
	return `${first.charAt(0).toLowerCase()}${first.slice(1)}${rest.length === 0 ? '' : ' '}${rest.join(' ')}`;
}

function possessive(name: string) {
	return /s$/i.test(name) ? `${name}’` : `${name}’s`;
}

function clean(value: string) {
	return value.replace(/\s+/g, ' ').trim();
}

export function formatMoney(value: number) {
	return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}
