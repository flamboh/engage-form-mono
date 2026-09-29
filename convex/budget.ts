import type { Doc } from './_generated/dataModel';
import { requestLifecycle, todayInEugene, type Stage } from './lifecycle';

export type BudgetLine = Doc<'organizations'>['budgetLines'][number];

export type FiscalYear = { year: number; start: string; end: string; label: string };

export type BudgetRequest = Pick<
	Doc<'purchaseRequests'>,
	'status' | 'budgetLineItem' | 'totalAmount' | 'vendor'
>;

export type BudgetLineSummary = {
	name: string;
	allocated: number | null;
	spent: number;
	pending: number;
	remaining: number | null;
	purchases: number;
	approvedCount: number;
	pendingVendors: string[];
};

export type BudgetSummary = {
	lines: BudgetLineSummary[];
	totals: { allocated: number; spent: number; pending: number; remaining: number };
	untracked: { spent: number; pending: number };
	purchases: number;
};

const PENDING_VENDORS = 3;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function fiscalYearOfDate(date: string): number {
	const match = date.match(DATE);
	if (!match) throw new Error(`Not a date: ${date}`);
	const year = Number(match[1]);
	return Number(match[2]) >= 7 ? year : year - 1;
}

export function currentFiscalYear(now: number): number {
	return fiscalYearOfDate(todayInEugene(now));
}

export function fiscalYearLabel(year: number) {
	return `${year}–${String((year + 1) % 100).padStart(2, '0')}`;
}

export function fiscalYear(year: number): FiscalYear {
	return {
		year,
		start: `${year}-07-01`,
		end: `${year + 1}-06-30`,
		label: fiscalYearLabel(year)
	};
}

export function fiscalYearStartMs(year: number) {
	return Date.UTC(year, 6, 1, 7);
}

export function requestDate(request: Pick<Doc<'purchaseRequests'>, 'receiptDate' | 'createdAt'>) {
	return request.receiptDate !== undefined && DATE.test(request.receiptDate)
		? request.receiptDate
		: todayInEugene(request.createdAt);
}

export function requestFiscalYear(
	request: Pick<Doc<'purchaseRequests'>, 'receiptDate' | 'createdAt'>
) {
	return fiscalYearOfDate(requestDate(request));
}

export function allocationFor(line: BudgetLine, year: number): number | null {
	return line.allocations.find((allocation) => allocation.fiscalYear === year)?.amount ?? null;
}

export function hasAllocations(lines: BudgetLine[]) {
	return lines.some((line) => line.allocations.length > 0);
}

const cents = (value: number) => Math.round(value * 100);
const dollars = (value: number) => value / 100;

export function summarizeBudget(
	lines: BudgetLine[],
	year: number,
	requests: BudgetRequest[]
): BudgetSummary {
	const rows = new Map<
		string,
		{
			allocated: number | null;
			spent: number;
			pending: number;
			purchases: number;
			approvedCount: number;
			pendingVendors: string[];
		}
	>();
	for (const line of lines) {
		const allocated = allocationFor(line, year);
		rows.set(line.name, {
			allocated: allocated === null ? null : cents(allocated),
			spent: 0,
			pending: 0,
			purchases: 0,
			approvedCount: 0,
			pendingVendors: []
		});
	}
	for (const request of requests) {
		let row = rows.get(request.budgetLineItem);
		if (row === undefined) {
			row = {
				allocated: null,
				spent: 0,
				pending: 0,
				purchases: 0,
				approvedCount: 0,
				pendingVendors: []
			};
			rows.set(request.budgetLineItem, row);
		}
		const amount = cents(request.totalAmount);
		row.purchases += 1;
		if (request.status === 'approved') {
			row.spent += amount;
			row.approvedCount += 1;
		} else {
			row.pending += amount;
			const vendor = request.vendor.trim();
			if (vendor !== '' && !row.pendingVendors.includes(vendor)) row.pendingVendors.push(vendor);
		}
	}
	const totals = { allocated: 0, spent: 0, pending: 0, remaining: 0 };
	const untracked = { spent: 0, pending: 0 };
	const summaries: BudgetLineSummary[] = [];
	for (const [name, row] of rows) {
		const remaining = row.allocated === null ? null : row.allocated - row.spent - row.pending;
		if (row.allocated === null) {
			untracked.spent += row.spent;
			untracked.pending += row.pending;
		} else {
			totals.allocated += row.allocated;
			totals.spent += row.spent;
			totals.pending += row.pending;
			totals.remaining += remaining ?? 0;
		}
		summaries.push({
			name,
			allocated: row.allocated === null ? null : dollars(row.allocated),
			spent: dollars(row.spent),
			pending: dollars(row.pending),
			remaining: remaining === null ? null : dollars(remaining),
			purchases: row.purchases,
			approvedCount: row.approvedCount,
			pendingVendors: row.pendingVendors.slice(0, PENDING_VENDORS)
		});
	}
	return {
		lines: summaries,
		totals: {
			allocated: dollars(totals.allocated),
			spent: dollars(totals.spent),
			pending: dollars(totals.pending),
			remaining: dollars(totals.remaining)
		},
		untracked: { spent: dollars(untracked.spent), pending: dollars(untracked.pending) },
		purchases: requests.length
	};
}

export function availableFiscalYears(
	lines: BudgetLine[],
	current: number,
	purchaseYears: number[]
): number[] {
	const years = new Set<number>([current, ...purchaseYears]);
	for (const line of lines) {
		for (const allocation of line.allocations) years.add(allocation.fiscalYear);
	}
	return [...years].sort((a, b) => b - a);
}

export function ledgerStage(request: Doc<'purchaseRequests'>, today: string): Stage {
	return requestLifecycle(request, {
		reading: false,
		readinessReady: request.status !== 'draft',
		today
	}).stage;
}
