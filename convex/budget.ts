import type { Doc } from './_generated/dataModel';
import { requestLifecycle, todayInEugene, type Stage } from './lifecycle';
import { budgetOptions, funds, optionLabel, resolvedSplits, type Fund } from './funds';

export type BudgetLine = Doc<'organizations'>['budgetLines'][number];

export type FiscalYear = { year: number; start: string; end: string; label: string };

export type BudgetRequest = Pick<
	Doc<'purchaseRequests'>,
	'status' | 'budgetSplits' | 'totalAmount' | 'vendor'
>;

export type BudgetLineSummary = {
	name: string;
	fund: Fund;
	allocated: number | null;
	spent: number;
	pending: number;
	remaining: number | null;
	purchases: number;
	approvedCount: number;
	pendingVendors: string[];
};

export type FundSummary = {
	fund: Fund;
	allocated: number | null;
	spent: number;
	pending: number;
	remaining: number | null;
};

export type BudgetSummary = {
	lines: BudgetLineSummary[];
	funds: FundSummary[];
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

function allocationFor(line: BudgetLine, year: number): number | null {
	return line.allocations.find((allocation) => allocation.fiscalYear === year)?.amount ?? null;
}

export type BudgetSource = Pick<Doc<'organizations'>, 'budgetLines' | 'fundAllocations'>;

function fundAllocationFor(source: BudgetSource, fund: Fund, year: number): number | null {
	return (
		(source.fundAllocations ?? []).find(
			(allocation) => allocation.fund === fund && allocation.fiscalYear === year
		)?.amount ?? null
	);
}

export function hasAllocations(source: BudgetSource) {
	return (
		(source.fundAllocations ?? []).length > 0 ||
		source.budgetLines.some((line) => line.allocations.length > 0)
	);
}

const cents = (value: number) => Math.round(value * 100);
const dollars = (value: number) => value / 100;

export function summarizeBudget(
	source: BudgetSource,
	year: number,
	requests: BudgetRequest[]
): BudgetSummary {
	const lines = source.budgetLines;
	const rows = new Map<
		string,
		{
			fund: Fund;
			allocated: number | null;
			spent: number;
			pending: number;
			purchases: number;
			approvedCount: number;
			pendingVendors: string[];
		}
	>();
	for (const option of budgetOptions(lines)) {
		const line = lines.find((item) => item.name === option.line);
		const allocated = line === undefined ? null : allocationFor(line, year);
		rows.set(optionLabel(option), {
			fund: option.fund,
			allocated: allocated === null ? null : cents(allocated),
			spent: 0,
			pending: 0,
			purchases: 0,
			approvedCount: 0,
			pendingVendors: []
		});
	}
	for (const request of requests) {
		for (const split of resolvedSplits(request.budgetSplits, request.totalAmount)) {
			const label = optionLabel(split);
			let row = rows.get(label);
			if (row === undefined) {
				row = {
					fund: split.fund,
					allocated: null,
					spent: 0,
					pending: 0,
					purchases: 0,
					approvedCount: 0,
					pendingVendors: []
				};
				rows.set(label, row);
			}
			const amount = cents(split.amount);
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
	}
	const summaries: BudgetLineSummary[] = [];
	for (const [name, row] of rows) {
		const remaining = row.allocated === null ? null : row.allocated - row.spent - row.pending;
		summaries.push({
			name,
			fund: row.fund,
			allocated: row.allocated === null ? null : dollars(row.allocated),
			spent: dollars(row.spent),
			pending: dollars(row.pending),
			remaining: remaining === null ? null : dollars(remaining),
			purchases: row.purchases,
			approvedCount: row.approvedCount,
			pendingVendors: row.pendingVendors.slice(0, PENDING_VENDORS)
		});
	}
	const fundSummaries = summarizeFunds(source, year, summaries);
	const totals = { allocated: 0, spent: 0, pending: 0, remaining: 0 };
	const untracked = { spent: 0, pending: 0 };
	for (const fund of fundSummaries) {
		if (fund.allocated === null) {
			untracked.spent += cents(fund.spent);
			untracked.pending += cents(fund.pending);
			continue;
		}
		totals.allocated += cents(fund.allocated);
		totals.spent += cents(fund.spent);
		totals.pending += cents(fund.pending);
		totals.remaining += cents(fund.remaining ?? 0);
	}
	return {
		lines: summaries,
		funds: fundSummaries,
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

function summarizeFunds(
	source: BudgetSource,
	year: number,
	lines: BudgetLineSummary[]
): FundSummary[] {
	return funds
		.map((fund) => {
			const inFund = lines.filter((line) => line.fund === fund);
			const tracked = inFund.filter((line) => line.allocated !== null);
			const sum = (values: number[]) =>
				dollars(values.reduce((acc, value) => acc + cents(value), 0));
			const allocated =
				fundAllocationFor(source, fund, year) ??
				(tracked.length === 0 ? null : sum(tracked.map((line) => line.allocated ?? 0)));
			const spent = sum(inFund.map((line) => line.spent));
			const pending = sum(inFund.map((line) => line.pending));
			return {
				fund,
				allocated,
				spent,
				pending,
				remaining:
					allocated === null ? null : dollars(cents(allocated) - cents(spent) - cents(pending))
			};
		})
		.filter(
			(summary) =>
				summary.allocated !== null || lines.some((line) => line.fund === summary.fund)
		);
}

export function availableFiscalYears(
	source: BudgetSource,
	current: number,
	purchaseYears: number[]
): number[] {
	const years = new Set<number>([current, ...purchaseYears]);
	for (const allocation of source.fundAllocations ?? []) years.add(allocation.fiscalYear);
	for (const line of source.budgetLines) {
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
