const monthDay = new Intl.DateTimeFormat('en-US', {
	month: 'short',
	day: 'numeric',
	timeZone: 'UTC'
});
const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' });
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const dayTime = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

function utcDate(value: string) {
	const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
	return match ? new Date(Date.UTC(+match[1], +match[2] - 1, +match[3])) : null;
}

export function formatMoney(value: number) {
	return currency.format(value);
}

export function formatShortDate(value: string) {
	const date = utcDate(value);
	return date ? monthDay.format(date) : value;
}

export function formatEventDay(value: string) {
	const date = utcDate(value);
	if (!date) return value;
	const month = String(date.getUTCMonth() + 1).padStart(2, '0');
	const day = String(date.getUTCDate()).padStart(2, '0');
	return `${weekday.format(date)} ${month}/${day}`;
}

export function formatDay(timestamp: number) {
	return dayTime.format(new Date(timestamp));
}

export function daysLeftLabel(daysLeft: number) {
	if (daysLeft === 0) return 'Due today';
	const count = Math.abs(daysLeft);
	return `${count} ${count === 1 ? 'day' : 'days'} ${daysLeft < 0 ? 'over' : 'left'}`;
}

export function daysLeftTone(daysLeft: number) {
	if (daysLeft < 0) return 'late';
	return daysLeft <= 7 ? 'soon' : 'calm';
}
