const weekdayNames = [
	'Sunday',
	'Monday',
	'Tuesday',
	'Wednesday',
	'Thursday',
	'Friday',
	'Saturday'
] as const;

const dayMs = 24 * 60 * 60 * 1000;

export type EventDateSuggestion = { suggested: string | null; dates: string[] };

export function parseIsoDate(value: string | null | undefined) {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value?.trim() ?? '');
	if (match === null) return null;
	const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
	if (date.getUTCMonth() !== Number(match[2]) - 1 || date.getUTCDate() !== Number(match[3])) {
		return null;
	}
	return date;
}

export function isoDate(date: Date) {
	return date.toISOString().slice(0, 10);
}

export function weekdayOf(value: string) {
	return parseIsoDate(value)?.getUTCDay() ?? null;
}

export function weekdayName(weekday: number) {
	return weekdayNames[weekday] ?? '';
}

export function todayInOregon(now = Date.now()) {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'America/Los_Angeles',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(new Date(now));
}

export function suggestEventDates(
	event: { weekday: number | null },
	receiptDate: string | null,
	today = todayInOregon()
): EventDateSuggestion {
	const now = parseIsoDate(today);
	if (now === null) return { suggested: null, dates: [] };
	const parsedReceipt = parseIsoDate(receiptDate);
	const receipt = parsedReceipt !== null && parsedReceipt <= now ? parsedReceipt : null;
	if (event.weekday === null || event.weekday < 0 || event.weekday > 6) {
		if (receipt === null) return { suggested: null, dates: [] };
		return { suggested: isoDate(receipt), dates: [isoDate(receipt)] };
	}
	const last = addDays(now, -((now.getUTCDay() - event.weekday + 7) % 7));
	const afterReceipt =
		receipt === null ? null : addDays(receipt, (event.weekday - receipt.getUTCDay() + 7) % 7);
	const suggested = afterReceipt !== null && afterReceipt > last ? afterReceipt : last;
	const dates = [addDays(suggested, -7), suggested, addDays(suggested, 7), afterReceipt]
		.filter((date): date is Date => date !== null)
		.map(isoDate);
	return { suggested: isoDate(suggested), dates: [...new Set(dates)].sort() };
}

function addDays(date: Date, days: number) {
	return new Date(date.getTime() + days * dayMs);
}

export function normalizeEventDates(dates: string[]) {
	return [...new Set(dates.map((date) => date.trim()))]
		.filter((date) => parseIsoDate(date) !== null)
		.sort();
}

export function formatEventDates(dates: string[]) {
	const valid = normalizeEventDates(dates);
	if (valid.length === 0) return '';
	const weekdays = new Set(valid.map((date) => weekdayOf(date)));
	if (valid.length > 1 && weekdays.size === 1) {
		const day = weekdayName([...weekdays][0] ?? 0);
		if (valid.length >= 5 && everyWeek(valid)) {
			return `every ${day} from ${monthDay(valid[0])} through ${monthDay(valid.at(-1) ?? '')}`;
		}
		return `${day}s (${valid.map(monthDay).join(', ')})`;
	}
	return joinList(valid.map((date) => `${weekdayName(weekdayOf(date) ?? 0)} ${monthDay(date)}`));
}

export function eventDatesPhrase(dates: string[]) {
	const text = formatEventDates(dates);
	if (text === '') return '';
	return text.startsWith('every ') ? text : `on ${text}`;
}

export function formatEventTime(value: string) {
	const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
	if (match === null) return value.trim();
	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	if (hours > 23 || minutes > 59) return value.trim();
	const hour = hours % 12 === 0 ? 12 : hours % 12;
	const suffix = hours < 12 ? 'am' : 'pm';
	return minutes === 0 ? `${hour}${suffix}` : `${hour}:${match[2]}${suffix}`;
}

export function joinList(values: string[]) {
	if (values.length <= 1) return values[0] ?? '';
	if (values.length === 2) return `${values[0]} and ${values[1]}`;
	return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
}

function everyWeek(dates: string[]) {
	return dates.every(
		(date, index) =>
			index === 0 ||
			(parseIsoDate(date)?.getTime() ?? 0) - (parseIsoDate(dates[index - 1])?.getTime() ?? 0) ===
				7 * dayMs
	);
}

function monthDay(value: string) {
	return `${value.slice(5, 7)}/${value.slice(8, 10)}`;
}
