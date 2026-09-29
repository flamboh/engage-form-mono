import { dateCandidates } from '../extraction/candidates';

export type CardCandidate = { digits: string; lines: string[] };
export type EventDateCandidate = { date: string; written: string; lines: string[] };
export type Fulfillment = 'delivered' | 'shipped' | 'pending' | 'in_person';

const maskedDigits = /(?:[x*•·.#]\s?){2,}[a-z]?\s?(\d{4})\b/gi;
const cardWords =
	/\b(?:visa|mastercard|master card|mc|amex|american express|discover|debit|credit|card|acct|account|ending(?: in)?|last 4|last four)\b/i;
const digitsAfterCardWord =
	/\b(?:visa|mastercard|master card|mc|amex|american express|discover|debit|credit|card|acct|account|ending(?: in)?|last 4|last four)\b[^\d\n]{0,16}?(?<![\d/])(\d{4})(?![\d/:])/gi;

export function cardCandidates(lines: string[]): CardCandidate[] {
	const found = new Map<string, string[]>();
	const add = (digits: string, line: string) => {
		const context = found.get(digits) ?? [];
		if (!context.includes(line) && context.length < 3) context.push(line);
		found.set(digits, context);
	};
	lines.forEach((line, index) => {
		for (const match of line.matchAll(maskedDigits)) add(match[1], line);
		for (const match of line.matchAll(digitsAfterCardWord)) add(match[1], line);
		const bare = /^\s*(\d{4})\s*$/.exec(line);
		const previous = lines[index - 1] ?? '';
		if (bare && cardWords.test(previous)) add(bare[1], `${previous} ${line}`);
	});
	return [...found].slice(0, 12).map(([digits, context]) => ({ digits, lines: context }));
}

const monthNames = [
	'january',
	'february',
	'march',
	'april',
	'may',
	'june',
	'july',
	'august',
	'september',
	'october',
	'november',
	'december'
];
const monthPattern =
	'(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const monthDay = new RegExp(
	`\\b${monthPattern}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?!\\s*[,.]?\\s*\\d{4})`,
	'gi'
);
const dayMonth = new RegExp(
	`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${monthPattern}\\b(?!\\.?,?\\s*\\d{4})`,
	'gi'
);
const slashDate = /(?<![\d/.$])(\d{1,2})\/(\d{1,2})(?![\d/])/g;

export function eventDateCandidates(lines: string[]): EventDateCandidate[] {
	const found = new Map<string, EventDateCandidate>();
	const add = (date: string, written: string, line: string) => {
		const candidate = found.get(date) ?? { date, written, lines: [] };
		if (!candidate.lines.includes(line) && candidate.lines.length < 3) candidate.lines.push(line);
		found.set(date, candidate);
	};
	for (const candidate of dateCandidates(lines)) {
		for (const line of candidate.lines) add(candidate.iso, candidate.written[0], line);
	}
	for (const line of lines) {
		for (const match of line.matchAll(monthDay)) {
			const date = monthDayKey(monthIndex(match[1]), Number(match[2]));
			if (date !== null) add(date, match[0], line);
		}
		for (const match of line.matchAll(dayMonth)) {
			const date = monthDayKey(monthIndex(match[2]), Number(match[1]));
			if (date !== null) add(date, match[0], line);
		}
		for (const match of line.matchAll(slashDate)) {
			const date = monthDayKey(Number(match[1]), Number(match[2]));
			if (date !== null) add(date, match[0], line);
		}
	}
	return [...found.values()].slice(0, 12);
}

function monthIndex(name: string) {
	const lower = name.toLowerCase();
	return monthNames.findIndex((month) => month.startsWith(lower.slice(0, 3))) + 1;
}

function monthDayKey(month: number, day: number) {
	if (month < 1 || month > 12 || day < 1) return null;
	const days = new Date(Date.UTC(2024, month, 0)).getUTCDate();
	if (day > days) return null;
	return `--${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function sameDay(documentDate: string, activityDate: string) {
	if (documentDate.startsWith('--')) return activityDate.slice(4) === documentDate.slice(1);
	return documentDate === activityDate;
}

const pendingWords =
	/\b(?:arriving|estimated (?:delivery|arrival)|expected (?:delivery|arrival)|not yet shipped|preparing (?:for|to) ship|pre-?order|order (?:is )?confirmed|order received)\b/i;
const doneWords = /\b(?:delivered|shipped|out for delivery|picked up|in transit)\b/i;

export function fulfillmentSignal(lines: string[]): Fulfillment | null {
	const text = lines.join('\n');
	const delivered = /\bdelivered\b|\bpicked up\b/i.test(text);
	if (delivered) return 'delivered';
	if (doneWords.test(text)) return 'shipped';
	if (pendingWords.test(text)) return 'pending';
	return null;
}

export function emailCandidates(lines: string[]) {
	const found: string[] = [];
	for (const line of lines) {
		for (const match of line.matchAll(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g)) {
			const email = match[0].toLowerCase();
			if (!found.includes(email)) found.push(email);
		}
	}
	return found.slice(0, 12);
}
