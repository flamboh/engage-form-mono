import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { api } from '../convex/_generated/api';
import type { Doc, Id } from '../convex/_generated/dataModel';
import schema from '../convex/schema';
import {
	availableFiscalYears,
	currentFiscalYear,
	fiscalYear,
	fiscalYearOfDate,
	requestDate,
	summarizeBudget,
	type BudgetLine
} from '../convex/budget';

vi.stubEnv('FILES_BASE_URL', 'https://files.example');
vi.stubEnv('FILES_SIGNING_SECRET', 'test-secret');

const modules = import.meta.glob('../convex/**/!(*.test).ts');

const line = (name: string, allocations: [number, number][] = []): BudgetLine => ({
	name,
	allocations: allocations.map(([fiscalYear, amount]) => ({ fiscalYear, amount }))
});

const spend = (
	budgetLineItem: string,
	totalAmount: number,
	status: Doc<'purchaseRequests'>['status'],
	vendor = 'Safeway'
) => ({ budgetLineItem, totalAmount, status, vendor });

describe('fiscal years', () => {
	test('Jun 30 closes one year and Jul 1 opens the next', () => {
		expect(fiscalYearOfDate('2026-06-30')).toBe(2025);
		expect(fiscalYearOfDate('2026-07-01')).toBe(2026);
		expect(fiscalYearOfDate('2027-01-15')).toBe(2026);
		expect(fiscalYear(2026)).toEqual({
			year: 2026,
			start: '2026-07-01',
			end: '2027-06-30',
			label: '2026–27'
		});
		expect(fiscalYear(2099).label).toBe('2099–00');
	});

	test('the current year turns over at midnight in Eugene, not UTC', () => {
		expect(currentFiscalYear(Date.parse('2026-07-01T06:30:00Z'))).toBe(2025);
		expect(currentFiscalYear(Date.parse('2026-07-01T07:00:00Z'))).toBe(2026);
	});

	test('a request without a receipt date counts on the day it was created', () => {
		expect(requestDate({ receiptDate: '2026-06-30', createdAt: 0 })).toBe('2026-06-30');
		expect(
			requestDate({ receiptDate: undefined, createdAt: Date.parse('2026-07-01T06:30:00Z') })
		).toBe('2026-06-30');
	});

	test('year chips cover the current year, allocated years and years with purchases', () => {
		expect(availableFiscalYears([line('Food', [[2024, 100]])], 2026, [2025])).toEqual([
			2026, 2025, 2024
		]);
		expect(availableFiscalYears([], 2026, [])).toEqual([2026]);
	});
});

describe('summarizeBudget', () => {
	test('approved is spent and draft or ready is pending', () => {
		const summary = summarizeBudget([line('Food', [[2026, 600]])], 2026, [
			spend('Food', 100.1, 'approved'),
			spend('Food', 0.2, 'approved'),
			spend('Food', 40, 'ready', 'Costco'),
			spend('Food', 10.5, 'draft', 'Safeway')
		]);
		expect(summary.lines).toEqual([
			{
				name: 'Food',
				allocated: 600,
				spent: 100.3,
				pending: 50.5,
				remaining: 449.2,
				approvedCount: 2,
				pendingVendors: ['Costco', 'Safeway']
			}
		]);
		expect(summary.totals).toEqual({
			allocated: 600,
			spent: 100.3,
			pending: 50.5,
			remaining: 449.2
		});
		expect(summary.purchases).toBe(4);
	});

	test('going over the allocation leaves a negative remainder', () => {
		const summary = summarizeBudget([line('Prizes', [[2026, 150]])], 2026, [
			spend('Prizes', 120, 'approved'),
			spend('Prizes', 74.97, 'draft', 'Amazon')
		]);
		expect(summary.lines[0]).toMatchObject({ remaining: -44.97 });
		expect(summary.totals.remaining).toBe(-44.97);
	});

	test('lines without an allocation that year are untracked and left out of the totals', () => {
		const summary = summarizeBudget(
			[line('Food', [[2026, 600]]), line('Advertising', [[2025, 90]])],
			2026,
			[spend('Food', 50, 'approved'), spend('Advertising', 45, 'approved')]
		);
		expect(summary.lines[1]).toMatchObject({
			name: 'Advertising',
			allocated: null,
			remaining: null
		});
		expect(summary.totals).toEqual({ allocated: 600, spent: 50, pending: 0, remaining: 550 });
		expect(summary.untracked).toEqual({ spent: 45, pending: 0 });
	});

	test('a request on a renamed line keeps its old name as its own untracked line', () => {
		const summary = summarizeBudget([line('Events', [[2026, 500]])], 2026, [
			spend('Event Expenses', 30, 'approved'),
			spend('Events', 20, 'draft')
		]);
		expect(summary.lines.map((item) => [item.name, item.allocated])).toEqual([
			['Events', 500],
			['Event Expenses', null]
		]);
		expect(summary.untracked).toEqual({ spent: 30, pending: 0 });
		expect(summary.totals.remaining).toBe(480);
	});

	test('pending vendors are listed once and capped at three', () => {
		const summary = summarizeBudget([line('Food', [[2026, 600]])], 2026, [
			spend('Food', 1, 'draft', 'Costco'),
			spend('Food', 1, 'draft', 'Costco'),
			spend('Food', 1, 'draft', 'Safeway'),
			spend('Food', 1, 'ready', "Trader Joe's"),
			spend('Food', 1, 'draft', 'Albertsons')
		]);
		expect(summary.lines[0].pendingVendors).toEqual(['Costco', 'Safeway', "Trader Joe's"]);
	});
});

describe('budget queries', () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-09-29T19:00:00Z'));
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	test('the summary reads one fiscal year and the ledger pages through it newest first', async () => {
		const t = convexTest(schema, modules);
		const { organizationId, insert } = await setup(t);
		await insert({ receiptDate: '2026-06-30', totalAmount: 11, vendor: 'Last year' });
		await insert({
			receiptDate: '2026-07-01',
			totalAmount: 20,
			vendor: 'Costco',
			status: 'approved'
		});
		await insert({ receiptDate: '2026-09-12', totalAmount: 30, vendor: 'Safeway' });
		await insert({
			receiptDate: '2026-08-02',
			totalAmount: 5,
			vendor: 'Old line',
			budgetLineItem: 'Snacks'
		});
		await insert({
			receiptDate: '2027-02-01',
			totalAmount: 40,
			vendor: 'Amazon',
			budgetLineItem: 'Prizes'
		});
		await insert({ receiptDate: undefined, totalAmount: 7, vendor: 'Undated' });
		const owner = t.withIdentity({ tokenIdentifier: 'owner' });

		const summary = await owner.query(api.authed.budget.budgetSummary, {
			organizationId,
			fiscalYear: 2026
		});
		expect(summary.fiscalYear.label).toBe('2026–27');
		expect(summary.purchases).toBe(5);
		expect(summary.lines).toMatchObject([
			{ name: 'Food', allocated: 100, spent: 20, pending: 37, remaining: 43 },
			{ name: 'Prizes', allocated: 25, spent: 0, pending: 40, remaining: -15 },
			{ name: 'Snacks', allocated: null, spent: 0, pending: 5, remaining: null }
		]);
		expect(summary.totals).toEqual({ allocated: 125, spent: 20, pending: 77, remaining: 28 });
		expect(summary.untracked).toEqual({ spent: 0, pending: 5 });
		expect(summary.fiscalYears.map((year) => year.year)).toContain(2025);

		const lastYear = await owner.query(api.authed.budget.budgetSummary, {
			organizationId,
			fiscalYear: 2025
		});
		expect(lastYear.purchases).toBe(1);
		expect(lastYear.lines[0]).toMatchObject({ name: 'Food', allocated: null, pending: 11 });

		const vendors: string[] = [];
		let cursor: string | null = null;
		let pages = 0;
		for (;;) {
			const page: Awaited<ReturnType<typeof ledgerPage>> = await ledgerPage(cursor);
			vendors.push(...page.page.map((row) => row.vendor));
			pages += 1;
			if (page.isDone) break;
			cursor = page.continueCursor;
		}
		expect(vendors).toEqual(['Amazon', 'Safeway', 'Old line', 'Costco', 'Undated']);
		expect(pages).toBeGreaterThanOrEqual(3);

		const approved = await owner.query(api.authed.budget.purchaseLedger, {
			organizationId,
			fiscalYear: 2026,
			stage: 'approved',
			paginationOpts: { numItems: 10, cursor: null }
		});
		expect(approved.page).toMatchObject([
			{ vendor: 'Costco', stage: 'approved', receiptDate: '2026-07-01' }
		]);
		expect(approved.page[0].approvedAt).toBeNull();

		const prizes = await owner.query(api.authed.budget.purchaseLedger, {
			organizationId,
			fiscalYear: 2026,
			budgetLine: 'Prizes',
			stage: 'unfinished',
			paginationOpts: { numItems: 10, cursor: null }
		});
		expect(prizes.page.map((row) => row.vendor)).toEqual(['Amazon']);

		function ledgerPage(cursor: string | null) {
			return owner.query(api.authed.budget.purchaseLedger, {
				organizationId,
				fiscalYear: 2026,
				paginationOpts: { numItems: 2, cursor }
			});
		}
	});

	test('another owner cannot read the budget', async () => {
		const t = convexTest(schema, modules);
		const { organizationId } = await setup(t);
		await expect(
			t
				.withIdentity({ tokenIdentifier: 'someone-else' })
				.query(api.authed.budget.budgetSummary, { organizationId })
		).rejects.toThrow('Record not found.');
	});

	test('marking approved stamps approvedAt and reopening clears it', async () => {
		const t = convexTest(schema, modules);
		const { insert } = await setup(t);
		const id = await insert({ receiptDate: '2026-09-01', totalAmount: 10, status: 'ready' });
		const owner = t.withIdentity({ tokenIdentifier: 'owner' });

		await owner.mutation(api.authed.purchaseBuilder.markApproved, { id });
		const approved = await t.run((ctx) => ctx.db.get(id));
		expect(approved?.status).toBe('approved');
		expect(approved?.approvedAt).toEqual(expect.any(Number));

		await owner.mutation(api.authed.purchaseBuilder.reopenPurchase, { id, clearFilled: false });
		const reopened = await t.run((ctx) => ctx.db.get(id));
		expect(reopened).toMatchObject({ status: 'ready', approvedAt: null });
	});

	test('organizations save allocations per fiscal year, rounded to cents', async () => {
		const t = convexTest(schema, modules);
		const owner = t.withIdentity({ tokenIdentifier: 'owner' });
		const id = await owner.mutation(api.authed.purchaseBuilder.upsertOrganization, {
			id: null,
			name: 'Album Listening Club',
			indexNumber: 'OS353i',
			fundLetter: 'I',
			budgetLines: [
				{
					name: ' Food ',
					allocations: [
						{ fiscalYear: 2026, amount: 100.004 },
						{ fiscalYear: 2025, amount: 80 },
						{ fiscalYear: 2026, amount: 120.456 }
					]
				},
				{ name: 'food', allocations: [] },
				{ name: '', allocations: [] }
			]
		});
		const organization = await t.run((ctx) => ctx.db.get(id));
		expect(organization?.budgetLines).toEqual([
			{
				name: 'Food',
				allocations: [
					{ fiscalYear: 2025, amount: 80 },
					{ fiscalYear: 2026, amount: 120.46 }
				]
			}
		]);
		await expect(
			owner.mutation(api.authed.purchaseBuilder.upsertOrganization, {
				id,
				name: 'Album Listening Club',
				indexNumber: 'OS353i',
				fundLetter: 'I',
				budgetLines: [{ name: 'Food', allocations: [{ fiscalYear: 2026, amount: -1 }] }]
			})
		).rejects.toThrow('Allocation for Food must be zero or more.');
	});

	test('a profile can be saved before the ID photos are added', async () => {
		const t = convexTest(schema, modules);
		const owner = t.withIdentity({ tokenIdentifier: 'owner' });
		const id = await owner.mutation(api.authed.purchaseBuilder.upsertUserProfile, {
			name: 'Oliver Boorstein',
			uo95: '952043159',
			permanentAddress: '11337 Our Rd',
			studentEmail: 'obo@uoregon.edu',
			phone: '9073104429',
			idCardFrontFileId: null,
			idCardBackFileId: null
		});
		const user = await t.run((ctx) => ctx.db.get(id));
		expect(user).toMatchObject({ idCardFrontFileId: null, idCardBackFileId: null });
	});
});

type Overrides = Partial<
	Pick<
		Doc<'purchaseRequests'>,
		'receiptDate' | 'totalAmount' | 'vendor' | 'status' | 'budgetLineItem'
	>
>;

async function setup(t: ReturnType<typeof convexTest>) {
	const { organizationId, userId } = await t.run(async (ctx) => {
		const userId = await ctx.db.insert('users', {
			owner: 'owner',
			name: 'Oliver Boorstein',
			uo95: '952043159',
			permanentAddress: '11337 Our Rd',
			studentEmail: 'obo@uoregon.edu',
			phone: '9073104429',
			idCardFrontFileId: null,
			idCardBackFileId: null,
			updatedAt: 0
		});
		const organizationId = await ctx.db.insert('organizations', {
			owner: 'owner',
			name: 'Album Listening Club',
			indexNumber: 'OS353i',
			fundLetter: 'I',
			budgetLines: [line('Food', [[2026, 100]]), line('Prizes', [[2026, 25]])],
			archived: false,
			updatedAt: 0
		});
		return { organizationId, userId };
	});
	const insert = (overrides: Overrides) =>
		t.run((ctx) => ctx.db.insert('purchaseRequests', request(organizationId, userId, overrides)));
	return { organizationId, insert };
}

function request(
	organizationId: Id<'organizations'>,
	userId: Id<'users'>,
	overrides: Overrides
): Omit<Doc<'purchaseRequests'>, '_id' | '_creationTime'> {
	const person = {
		id: userId,
		name: 'Oliver Boorstein',
		uo95: '952043159',
		permanentAddress: '11337 Our Rd',
		idCardFrontFileId: null,
		idCardBackFileId: null
	};
	return {
		owner: 'owner',
		status: 'draft',
		typeOfPurchase: 'personal_reimbursement',
		documentationCategories: [],
		organizationSourceId: organizationId,
		purchaserSource: { kind: 'self' },
		studentOrganization: {
			name: 'Album Listening Club',
			indexNumber: 'OS353i',
			fundLetter: 'I',
			budgetLines: ['Food', 'Prizes']
		},
		requester: { ...person, email: 'obo@uoregon.edu', phone: '9073104429' },
		purchaser: person,
		activity: {
			eventId: null,
			name: 'Weekly listening event',
			dates: [],
			time: '',
			location: '',
			attendance: null,
			openToAllStudents: true
		},
		vendor: 'Safeway',
		itemDescription: 'snacks',
		totalAmount: 0,
		budgetLineItem: 'Food',
		reimbursementReason: 'Other processes are too slow.',
		businessPurposeOverride: null,
		receiptFileIds: [],
		secondApprovalFileId: null,
		publicityFileId: null,
		cateringWaiverFileId: null,
		printingInvoiceFileId: null,
		brandApprovalFileId: null,
		officeLocation: '',
		buildingManagerApprovalFileId: null,
		computerPriceQuoteFileId: null,
		recipients: [],
		createdAt: Date.now(),
		updatedAt: Date.now(),
		lastFilledAt: null,
		approvedAt: null,
		reviewerNote: null,
		...overrides
	};
}
