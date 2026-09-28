export type DocumentText = {
	source: 'text_layer' | 'textract';
	lines: string[];
	hints: {
		vendorNames: string[];
		itemNames: string[];
	};
};

export type MoneyCandidate = { value: string; lines: string[] };
export type DateCandidate = { iso: string; written: string[]; lines: string[] };
export type VendorCandidate = { text: string; note: string | null };

const moneyPattern = /(?<![\d/])\$?\s?\d{1,3}(?:,\d{3})*[.·•]\d{2}(?!\d)/g;
const monthNames =
	'jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december';
const datePatterns = [
	/(?<!\d)\d{4}-\d{2}-\d{2}(?!\d)/g,
	/(?<!\d)\d{1,2}\/\d{1,2}\/(?:\d{4}|\d{2}(?!\d))/g,
	/(?<!\d)\d{1,2}-\d{1,2}-\d{4}/g,
	new RegExp(`(?<!\\d)\\d{1,2}-(?:${monthNames})-\\d{4}`, 'gi'),
	new RegExp(`(?:${monthNames})\\.?\\s*\\d{1,2},?\\s*\\d{4}`, 'gi'),
	new RegExp(`(?<!\\d)\\d{1,2}\\s+(?:${monthNames})\\.?,?\\s+\\d{4}`, 'gi')
];
const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export const maxVendorLines = 200;
export const maxItemLines = 120;

export function moneyCandidates(lines: string[]): MoneyCandidate[] {
	const found = new Map<string, string[]>();
	for (const line of lines) {
		for (const match of line.matchAll(moneyPattern)) {
			const value = normalizeMoney(match[0]);
			if (value === null) continue;
			const context = found.get(value) ?? [];
			if (!context.includes(line)) context.push(line);
			found.set(value, context);
		}
	}
	return [...found].map(([value, context]) => ({ value, lines: context.slice(0, 4) }));
}

export function normalizeMoney(raw: string) {
	const cleaned = raw.replace(/[·•]/g, '.').replace(/[^0-9.]/g, '');
	const value = Number(cleaned);
	if (cleaned === '' || !Number.isFinite(value)) return null;
	return value.toFixed(2);
}

export function dateCandidates(lines: string[]): DateCandidate[] {
	const found = new Map<string, DateCandidate>();
	for (const line of lines) {
		const repaired = line.replace(/(?<!\d)0(?=ctober)/gi, 'O');
		for (const pattern of datePatterns) {
			for (const match of repaired.matchAll(pattern)) {
				const iso = parseDate(match[0]);
				if (iso === null) continue;
				const candidate = found.get(iso) ?? { iso, written: [], lines: [] };
				if (!candidate.written.includes(match[0])) candidate.written.push(match[0]);
				if (!candidate.lines.includes(line) && candidate.lines.length < 3) {
					candidate.lines.push(line);
				}
				found.set(iso, candidate);
			}
		}
	}
	return [...found.values()];
}

export function parseDate(raw: string): string | null {
	const text = raw.trim();
	const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
	if (iso) return isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
	const numeric = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/.exec(text);
	if (numeric) {
		const year = numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
		return isoDate(year, Number(numeric[1]), Number(numeric[2]));
	}
	const dayMonth = /^(\d{1,2})[-\s]+([a-z]+)\.?,?[-\s]+(\d{4})$/i.exec(text);
	if (dayMonth) {
		const month = monthNumber(dayMonth[2]);
		return month === null ? null : isoDate(Number(dayMonth[3]), month, Number(dayMonth[1]));
	}
	const monthDay = /^([a-z]+)\.?\s*(\d{1,2}),?\s*(\d{4})$/i.exec(text);
	if (monthDay) {
		const month = monthNumber(monthDay[1]);
		return month === null ? null : isoDate(Number(monthDay[3]), month, Number(monthDay[2]));
	}
	return null;
}

function monthNumber(name: string) {
	const lower = name.toLowerCase();
	const full = [
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
	const index = months.indexOf(lower.slice(0, 3));
	if (index === -1) return null;
	if (lower.length > 3 && lower !== 'sept' && !full[index].startsWith(lower)) return null;
	return index + 1;
}

function isoDate(year: number, month: number, day: number) {
	if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1) return null;
	const date = new Date(Date.UTC(year, month - 1, day));
	if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
	return date.toISOString().slice(0, 10);
}

export function vendorCandidates(text: DocumentText): VendorCandidate[] {
	const seen = new Map<string, string | null>();
	const add = (value: string, note: string | null) => {
		const candidate = value.replace(/\s+/g, ' ').trim().slice(0, 120);
		if (!/[A-Za-z]{2}/.test(candidate) || seen.has(candidate)) return;
		seen.set(candidate, note);
	};
	for (const line of text.lines.slice(0, maxVendorLines)) {
		if (/[A-Za-z].*[A-Za-z].*[A-Za-z]/.test(line)) add(line, null);
	}
	for (const name of text.hints.vendorNames) add(name, null);
	for (const line of text.lines) {
		for (const match of line.matchAll(/[\w.+-]+@([\w-]+(?:\.[\w-]+)+)/g)) {
			add(match[1].toLowerCase(), 'email domain');
		}
		for (const match of line.matchAll(
			/(?:https?:\/\/)?(?:www\.)?((?:[a-z0-9-]+\.)+(?:com|net|org|co|shop|store|us|io)(?:\.[a-z]{2})?)(?![\w@])/gi
		)) {
			if (line.slice(Math.max(0, (match.index ?? 0) - 1), match.index).includes('@')) continue;
			add(match[1].toLowerCase(), 'web address');
		}
	}
	return [...seen].slice(0, 250).map(([candidate, note]) => ({ text: candidate, note }));
}

export function itemLineCandidates(text: DocumentText) {
	const lines = text.lines.slice(0, maxItemLines);
	return lines
		.map((line, index) => ({ line, index }))
		.filter(({ line }) => /[A-Za-z]{2}/.test(line) && !/^\s*\$?\s?[\d.,]+\s*$/.test(line));
}

const vendorPrefixes =
	/^(?:sold by|supplied by|shipped by|merchant|store|seller|vendor|from|order from|thank you for shopping at|welcome to)\s*[:-]?\s*/i;
const corporateSuffixes =
	/[\s,]+(?:inc|llc|l\.l\.c|ltd|limited|corp|corporation|co|company|as|a\/s|gmbh|plc|pty|pty ltd)\.?$/i;
const smallWords = new Set(['of', 'and', 'the', 'a', 'an', 'for', 'at', 'on', 'in', 'to', 'by']);

export function cleanVendor(raw: string) {
	let text = raw.replace(/\s+/g, ' ').trim().replace(vendorPrefixes, '');
	const domain = /^(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+)((?:\.[a-z]{2,})+)\/?$/i.exec(text);
	if (domain) {
		text = domain[1].replace(/-/g, ' ');
	} else {
		text = text.replace(/\.(?:com|net|org|co)(?:\.[a-z]{2})?\b/gi, '');
	}
	text = text
		.replace(/\s*(?:#|no\.?|store)\s*\d+\s*$/i, '')
		.replace(/\s+\d+\s*$/, '')
		.replace(/[\s#*|:,-]+$/, '')
		.trim();
	for (let index = 0; index < 2; index += 1) text = text.replace(corporateSuffixes, '').trim();
	if (text === '') return raw.trim();
	return hasMixedCase(text) ? text : titleCase(text);
}

export function vendorKey(value: string) {
	return value.toLowerCase().replace(/[^a-z]/g, '');
}

export function preferredVendor(choice: string, candidates: string[]) {
	const cleaned = cleanVendor(choice);
	const key = vendorKey(cleaned);
	if (key === '') return cleaned;
	let best = cleaned;
	for (const candidate of candidates) {
		const other = cleanVendor(candidate);
		if (vendorKey(other) !== key) continue;
		if (wordCount(other) > wordCount(best)) best = other;
	}
	return best;
}

function wordCount(value: string) {
	return value.split(/\s+/).filter((word) => word !== '').length;
}

function hasMixedCase(value: string) {
	return /[a-z]/.test(value) && /[A-Z]/.test(value);
}

export function titleCase(value: string) {
	return value
		.toLowerCase()
		.split(/\s+/)
		.map((word, index) =>
			index > 0 && smallWords.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)
		)
		.join(' ');
}

const itemNoise =
	/^(?:shipping|handling|shipping & handling|tax|sales tax|subtotal|total|discount|tip|fee|fees|delivery)\b/i;

export function cleanItem(raw: string) {
	let text = raw.replace(/\s+/g, ' ').trim();
	text = text
		.replace(/^\d{4,}\s+/, '')
		.replace(/\s+\d{4,}$/, '')
		.replace(/\s*\$?\s?\d{1,3}(?:,\d{3})*[.·•]\d{2}\b.*$/, '')
		.replace(/\s*[x×]\s*\d+\s*$/i, '')
		.replace(/\s*(?:qty|quantity)\s*:?\s*\d+\s*$/i, '')
		.replace(/^\d{1,3}\s*(?:x|×|@)?\s+(?=[A-Za-z])/i, '')
		.replace(/^(?:ct|pk|pack)\s+/i, '')
		.replace(/[\s|*:,-]+$/, '')
		.trim();
	if (!/[A-Za-z]{2}/.test(text) || itemNoise.test(text)) return null;
	if (hasMixedCase(text)) return text;
	return text
		.split(/\s+/)
		.map((word) =>
			/^[A-Z0-9]{1,2}$/.test(word) || /^[B-DF-HJ-NP-TV-XZ0-9]{2,5}$/.test(word)
				? word
				: word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
		)
		.join(' ');
}

export function describeItems(items: string[], maxItems = 4) {
	const unique: string[] = [];
	for (const item of items) {
		const cleaned = cleanItem(item);
		if (cleaned === null) continue;
		const key = itemKey(cleaned);
		const covered = unique.findIndex(
			(existing) => itemKey(existing).includes(key) || key.includes(itemKey(existing))
		);
		if (covered === -1) {
			unique.push(cleaned);
			continue;
		}
		if (cleaned.length > unique[covered].length) unique[covered] = cleaned;
	}
	if (unique.length <= maxItems) return unique.join(', ');
	return `${unique.slice(0, maxItems).join(', ')}, and ${unique.length - maxItems} more`;
}

function itemKey(value: string) {
	return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}
