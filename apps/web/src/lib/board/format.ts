const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function formatMoney(value: number) {
	return currency.format(value);
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
