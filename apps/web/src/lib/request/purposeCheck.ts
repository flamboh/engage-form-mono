export type OmittedFact = 'vendor' | 'total' | 'attendance' | 'dates';

const months = [
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

export const omittedFactLabels: Record<OmittedFact, string> = {
	vendor: 'the store',
	total: 'the total',
	attendance: 'how many students attended',
	dates: 'the event date'
};

export function omittedFacts(
	text: string,
	facts: { vendor: string; totalAmount: number | null; attendance: number | null; dates: string[] }
): OmittedFact[] {
	const plain = text.toLowerCase().replace(/,(?=\d{3})/g, '');
	const omitted: OmittedFact[] = [];
	const vendor = facts.vendor.trim().toLowerCase();
	if (vendor !== '' && !plain.includes(vendor)) omitted.push('vendor');
	if (
		facts.totalAmount !== null &&
		facts.totalAmount > 0 &&
		!mentionsAmount(plain, facts.totalAmount)
	)
		omitted.push('total');
	if (facts.attendance !== null && !hasNumber(plain, String(facts.attendance)))
		omitted.push('attendance');
	if (facts.dates.length > 0 && !facts.dates.some((date) => mentionsDate(plain, date)))
		omitted.push('dates');
	return omitted;
}

function hasNumber(text: string, value: string) {
	return new RegExp(`(^|[^\\d.])${value.replace('.', '\\.')}(?![\\d])`).test(text);
}

function mentionsAmount(text: string, amount: number) {
	if (hasNumber(text, amount.toFixed(2))) return true;
	return Number.isInteger(amount) && hasNumber(text, String(amount));
}

function mentionsDate(text: string, date: string) {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
	if (match === null) return false;
	const month = Number(match[2]);
	const day = Number(match[3]);
	const numeric = new RegExp(`(^|\\D)0?${month}/0?${day}(?!\\d)`);
	if (numeric.test(text)) return true;
	const name = months[month - 1];
	return new RegExp(`\\b(${name}|${name.slice(0, 3)})\\.? ${day}(?!\\d)`).test(text);
}
