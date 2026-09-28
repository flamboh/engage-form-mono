const monthDay = new Intl.DateTimeFormat('en-US', {
	month: 'short',
	day: 'numeric',
	timeZone: 'UTC'
});
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function formatMoney(value: number) {
	return currency.format(value);
}

export function formatShortDate(value: string) {
	const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (!match) return value;
	return monthDay.format(new Date(Date.UTC(+match[1], +match[2] - 1, +match[3])));
}

export function requestFacts(item: { vendor: string; totalAmount: number; date: string }) {
	return [
		item.vendor.trim(),
		item.totalAmount > 0 ? formatMoney(item.totalAmount) : '',
		item.date ? formatShortDate(item.date) : ''
	].filter((part) => part !== '');
}
