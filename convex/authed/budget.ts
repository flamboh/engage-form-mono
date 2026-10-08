import { z } from 'zod/v4';
import { zid } from 'convex-helpers/server/zod4';
import { mergedStream, stream } from 'convex-helpers/server/stream';
import schema from '../schema';
import type { Doc, Id } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import {
	availableFiscalYears,
	currentFiscalYear,
	fiscalYear,
	fiscalYearStartMs,
	hasAllocations,
	ledgerStage,
	requestDate,
	requestFiscalYear,
	summarizeBudget
} from '../budget';
import { todayInEugene } from '../lifecycle';
import { optionLabel, splitsLabel } from '../funds';
import { fund } from '../purchaseZod';
import { ownerFromIdentity, requireOwnedDoc } from '../purchaseModel';
import { authedQuery } from './helpers';
import { stage } from '../requestView';

const MAX_REQUESTS_PER_YEAR = 500;
const YEARS_BACK = 5;
const RECEIPT_DATE_INDEX = 'by_owner_and_organizationSourceId_and_receiptDate';

const fiscalYearShape = z.object({
	year: z.number(),
	start: z.string(),
	end: z.string(),
	label: z.string()
});

const budgetSummaryShape = z.object({
	fiscalYear: fiscalYearShape,
	fiscalYears: z.array(fiscalYearShape),
	lines: z.array(
		z.object({
			name: z.string(),
			fund,
			allocated: z.number().nullable(),
			spent: z.number(),
			pending: z.number(),
			remaining: z.number().nullable(),
			purchases: z.number(),
			approvedCount: z.number(),
			pendingVendors: z.array(z.string())
		})
	),
	totals: z.object({
		allocated: z.number(),
		spent: z.number(),
		pending: z.number(),
		remaining: z.number()
	}),
	funds: z.array(
		z.object({
			fund,
			allocated: z.number().nullable(),
			spent: z.number(),
			pending: z.number(),
			remaining: z.number().nullable()
		})
	),
	untracked: z.object({ spent: z.number(), pending: z.number() }),
	purchases: z.number()
});

const ledgerRow = z.object({
	id: zid('purchaseRequests'),
	receiptDate: z.string(),
	vendor: z.string(),
	itemDescription: z.string(),
	budgetLabel: z.string(),
	eventName: z.string(),
	eventDates: z.array(z.string()),
	stage,
	totalAmount: z.number(),
	filledAt: z.number().nullable(),
	approvedAt: z.number().nullable()
});

export type BudgetSummary = z.infer<typeof budgetSummaryShape>;
export type LedgerRow = z.infer<typeof ledgerRow>;

const paginationOpts = z.object({
	numItems: z.number(),
	cursor: z.string().nullable(),
	endCursor: z.string().nullable().optional(),
	id: z.number().optional(),
	maximumRowsRead: z.number().optional(),
	maximumBytesRead: z.number().optional()
});

export const budgetSummary = authedQuery({
	args: { organizationId: zid('organizations'), fiscalYear: z.number().int().optional() },
	returns: budgetSummaryShape,
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const organization = await requireOwnedDoc(ctx, 'organizations', args.organizationId, owner);
		const now = Date.now();
		const current = currentFiscalYear(now);
		const year = args.fiscalYear ?? current;
		const requests = await yearStream(ctx, owner, organization._id, year).take(
			MAX_REQUESTS_PER_YEAR
		);
		const purchaseYears = await yearsWithPurchases(ctx, owner, organization._id, current);
		return {
			fiscalYear: fiscalYear(year),
			fiscalYears: availableFiscalYears(organization.budgetLines, current, purchaseYears).map(
				fiscalYear
			),
			...summarizeBudget(organization.budgetLines, year, requests)
		};
	}
});

export const budgetLeft = authedQuery({
	args: { purchaseRequestId: zid('purchaseRequests') },
	returns: z.record(z.string(), z.number().nullable()).nullable(),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const request = await requireOwnedDoc(ctx, 'purchaseRequests', args.purchaseRequestId, owner);
		if (request.organizationSourceId === null) return null;
		const organization = await requireOwnedDoc(
			ctx,
			'organizations',
			request.organizationSourceId,
			owner
		);
		if (!hasAllocations(organization.budgetLines)) return null;
		const year = requestFiscalYear(request);
		const others = (
			await yearStream(ctx, owner, organization._id, year).take(MAX_REQUESTS_PER_YEAR)
		).filter((other) => other._id !== request._id);
		const summary = summarizeBudget(organization.budgetLines, year, others);
		return Object.fromEntries(summary.lines.map((line) => [line.name, line.remaining]));
	}
});

export const purchaseLedger = authedQuery({
	args: {
		organizationId: zid('organizations'),
		fiscalYear: z.number().int().optional(),
		budgetLine: z.string().optional(),
		stage: z.enum(['unfinished', 'approved']).optional(),
		paginationOpts
	},
	returns: z.object({
		page: z.array(ledgerRow),
		isDone: z.boolean(),
		continueCursor: z.string(),
		splitCursor: z.string().nullable().optional(),
		pageStatus: z.enum(['SplitRecommended', 'SplitRequired']).nullable().optional()
	}),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		await requireOwnedDoc(ctx, 'organizations', args.organizationId, owner);
		const year = args.fiscalYear ?? currentFiscalYear(Date.now());
		const today = todayInEugene(Date.now());
		const result = await yearStream(ctx, owner, args.organizationId, year)
			.filterWith(async (request) => {
				if (
					args.budgetLine !== undefined &&
					!request.budgetSplits.some((split) => optionLabel(split) === args.budgetLine)
				) {
					return false;
				}
				if (args.stage === 'approved') return request.status === 'approved';
				if (args.stage === 'unfinished') return request.status !== 'approved';
				return true;
			})
			.paginate({
				...args.paginationOpts,
				numItems: Math.min(args.paginationOpts.numItems, MAX_REQUESTS_PER_YEAR),
				maximumRowsRead: MAX_REQUESTS_PER_YEAR
			});
		return { ...result, page: result.page.map((request) => toLedgerRow(request, today)) };
	}
});

function toLedgerRow(request: Doc<'purchaseRequests'>, today: string): LedgerRow {
	return {
		id: request._id,
		receiptDate: requestDate(request),
		vendor: request.vendor,
		itemDescription: request.itemDescription,
		budgetLabel: splitsLabel(request.budgetSplits),
		eventName: request.activity.name,
		eventDates: request.activity.dates,
		stage: ledgerStage(request, today),
		totalAmount: request.totalAmount,
		filledAt: request.lastFilledAt,
		approvedAt: request.approvedAt
	};
}

function yearStream(
	ctx: QueryCtx,
	owner: string,
	organizationId: Id<'organizations'>,
	year: number
) {
	const range = fiscalYear(year);
	const requests = stream(ctx.db, schema).query('purchaseRequests');
	const dated = requests
		.withIndex(RECEIPT_DATE_INDEX, (q) =>
			q
				.eq('owner', owner)
				.eq('organizationSourceId', organizationId)
				.gte('receiptDate', range.start)
				.lte('receiptDate', range.end)
		)
		.order('desc');
	const undated = requests
		.withIndex(RECEIPT_DATE_INDEX, (q) =>
			q
				.eq('owner', owner)
				.eq('organizationSourceId', organizationId)
				.eq('receiptDate', undefined)
				.gte('_creationTime', fiscalYearStartMs(year))
				.lt('_creationTime', fiscalYearStartMs(year + 1))
		)
		.order('desc');
	return mergedStream([dated, undated], ['receiptDate', '_creationTime']);
}

async function yearsWithPurchases(
	ctx: QueryCtx,
	owner: string,
	organizationId: Id<'organizations'>,
	current: number
) {
	const years: number[] = [];
	for (let year = current - YEARS_BACK; year <= current; year += 1) {
		const range = fiscalYear(year);
		const dated = await ctx.db
			.query('purchaseRequests')
			.withIndex(RECEIPT_DATE_INDEX, (q) =>
				q
					.eq('owner', owner)
					.eq('organizationSourceId', organizationId)
					.gte('receiptDate', range.start)
					.lte('receiptDate', range.end)
			)
			.first();
		const found =
			dated ??
			(await ctx.db
				.query('purchaseRequests')
				.withIndex(RECEIPT_DATE_INDEX, (q) =>
					q
						.eq('owner', owner)
						.eq('organizationSourceId', organizationId)
						.eq('receiptDate', undefined)
						.gte('_creationTime', fiscalYearStartMs(year))
						.lt('_creationTime', fiscalYearStartMs(year + 1))
				)
				.first());
		if (found !== null) years.push(year);
	}
	return years;
}
