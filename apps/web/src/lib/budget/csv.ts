import type { LedgerRow } from '$convex/authed/budget';
import { stageLabels } from '../../../../../convex/lifecycle';

const ledgerColumns = [
	'Bought',
	'Vendor',
	'Items',
	'Budget line',
	'Event',
	'Event dates',
	'Status',
	'Amount',
	'Filled',
	'Approved'
];

const eugeneDay = new Intl.DateTimeFormat('en-CA', {
	timeZone: 'America/Los_Angeles',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit'
});

function day(timestamp: number | null) {
	return timestamp === null ? '' : eugeneDay.format(new Date(timestamp));
}

function text(value: string) {
	const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
	return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function ledgerCsv(rows: LedgerRow[]) {
	const lines = [
		ledgerColumns.join(','),
		...rows.map((row) =>
			[
				row.receiptDate,
				text(row.vendor),
				text(row.itemDescription),
				text(row.budgetLabel),
				text(row.eventName),
				row.eventDates.join(' '),
				stageLabels[row.stage],
				row.totalAmount.toFixed(2),
				day(row.filledAt),
				day(row.approvedAt)
			].join(',')
		)
	];
	return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function csvFilename(organizationName: string, label: string) {
	const slug = organizationName
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
	return `${slug || 'purchases'}-${label.replace('–', '-')}.csv`;
}
