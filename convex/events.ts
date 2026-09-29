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

export type EventDateSuggestion = { suggested: string | null; alternatives: string[] };

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
	receiptDate: string | null
): EventDateSuggestion {
	const receipt = parseIsoDate(receiptDate);
	if (receipt === null) return { suggested: null, alternatives: [] };
	if (event.weekday === null || event.weekday < 0 || event.weekday > 6) {
		return { suggested: isoDate(receipt), alternatives: [] };
	}
	const offset = (event.weekday - receipt.getUTCDay() + 7) % 7;
	const next = new Date(receipt.getTime() + offset * dayMs);
	const previous = new Date(next.getTime() - 7 * dayMs);
	return { suggested: isoDate(next), alternatives: [isoDate(previous)] };
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
		const [weekday] = [...weekdays];
		return `${weekdayName(weekday ?? 0)}s (${valid.map(monthDay).join(', ')})`;
	}
	return joinList(valid.map((date) => `${weekdayName(weekdayOf(date) ?? 0)} ${monthDay(date)}`));
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

function monthDay(value: string) {
	return `${value.slice(5, 7)}/${value.slice(8, 10)}`;
}
