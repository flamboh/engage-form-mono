const parts = new Intl.DateTimeFormat('en-US', {
	timeZone: 'America/Los_Angeles',
	year: 'numeric',
	month: 'numeric'
});

export function fiscalYearOf(timestamp: number) {
	const values = parts.formatToParts(timestamp);
	const year = Number(values.find((part) => part.type === 'year')?.value);
	const month = Number(values.find((part) => part.type === 'month')?.value);
	return month >= 7 ? year : year - 1;
}

export function fiscalYearLabel(year: number) {
	return `${year}–${String((year + 1) % 100).padStart(2, '0')}`;
}
