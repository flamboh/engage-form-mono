import { z } from 'zod/v4';
import { zid } from 'convex-helpers/server/zod4';
import type { Doc } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import { fiscalYearOf, requestLifecycle, todayInEugene, type Stage } from '../lifecycle';
import { ownerFromIdentity, readinessWithChecks, requireOwnedDoc } from '../purchaseModel';
import { requestExtractions } from '../checks/load';
import type { PurchaseReadiness } from '../purchaseReadiness';
import { authedMutation, authedQuery } from './helpers';

const stage = z.enum(['reading', 'after_event', 'to_finish', 'ready', 'filled', 'approved']);

const boardItem = z.object({
	id: zid('purchaseRequests'),
	vendor: z.string(),
	itemDescription: z.string(),
	totalAmount: z.number(),
	receiptDate: z.string().nullable(),
	budgetLineItem: z.string(),
	stage,
	nextStep: z.string().nullable(),
	finishAfter: z.string().nullable(),
	deadline: z.string().nullable(),
	daysLeft: z.number().nullable(),
	reading: z.boolean(),
	receiptCount: z.number(),
	lastFilledAt: z.number().nullable(),
	updatedAt: z.number()
});

export type BoardItem = z.infer<typeof boardItem>;

export const sentBackStep = 'Fix what Engage sent back';

const nextStepRules: [RegExp, string][] = [
	[/^Your UO ID/, 'Add your UO ID (front and back)'],
	[/^Purchaser UO ID/, 'Add their UO ID (front and back)'],
	[/^Receipt document missing/, 'Add a receipt'],
	[/^Receipt documents are limited/, 'Keep it to three receipts'],
	[/^Vendor missing/, 'Add where it was bought'],
	[/^Total amount/, 'Add the total'],
	[/^Item description missing/, 'Say what was bought'],
	[/^Business purpose/, 'Say what it was for'],
	[/^Budget line/, 'Pick a budget line'],
	[/^Recipient/, 'Add who received it'],
	[/^Office location missing/, 'Add where it will be kept'],
	[/^Second approval missing/, 'Add a second approval'],
	[/^Publicity proof missing/, 'Add proof the event was advertised'],
	[/^Printing invoice missing/, 'Add the printing invoice'],
	[/^Purchaser profile must belong/, 'Choose who paid again'],
	[/^(Purchaser|ID card)/, 'Finish who paid'],
	[/^Requester/, 'Finish your profile'],
	[/^(Student organization|Index number)/, 'Finish the organization details'],
	[/^Type of Purchase/, 'Only reimbursements are supported']
];

const reasonPriority = [
	'Receipt document missing.',
	'Vendor missing.',
	'Total amount must be greater than zero.',
	'Business purpose missing.',
	'Item description missing.'
];

export function plainNextStep(
	readiness: Pick<PurchaseReadiness, 'sections'>,
	checks: { severity: 'blocking' | 'warning'; title: string }[]
): string | null {
	const reasons = readiness.sections
		.flatMap((section) => section.reasons)
		.filter((reason) => !checks.some((check) => check.title === reason));
	const blocking = checks.find((check) => check.severity === 'blocking');
	if (reasons.includes(reasonPriority[0])) return 'Add a receipt';
	if (blocking !== undefined) return blocking.title;
	if (reasons.length === 0) return null;
	const first =
		reasonPriority.find((reason) => reasons.includes(reason)) ??
		reasons.find((reason) => !reason.startsWith('Business purpose has')) ??
		reasons[0];
	const rule = nextStepRules.find(([pattern]) => pattern.test(first));
	return rule === undefined ? first.replace(/\.$/, '') : rule[1];
}

const openLimit = 50;
const approvedLimit = 500;

export const organizationBoard = authedQuery({
	args: { organizationId: zid('organizations'), today: z.string().optional() },
	returns: z.object({
		organization: z.object({
			id: zid('organizations'),
			name: z.string(),
			hasAllocations: z.boolean()
		}),
		readyToFill: z.array(boardItem),
		toFinish: z.array(boardItem),
		afterEvent: z.array(boardItem),
		waitingOnEngage: z.array(boardItem),
		approvedThisYear: z.object({ count: z.number(), total: z.number() })
	}),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const organization = await requireOwnedDoc(ctx, 'organizations', args.organizationId, owner);
		const today = args.today ?? todayInEugene(Date.now());
		const byStatus = (status: Doc<'purchaseRequests'>['status'], limit: number) =>
			ctx.db
				.query('purchaseRequests')
				.withIndex('by_owner_and_organizationSourceId_and_status_and_updatedAt', (q) =>
					q.eq('owner', owner).eq('organizationSourceId', organization._id).eq('status', status)
				)
				.order('desc')
				.take(limit);
		const [drafts, ready, approved] = await Promise.all([
			byStatus('draft', openLimit),
			byStatus('ready', openLimit),
			byStatus('approved', approvedLimit)
		]);
		const items = await Promise.all(
			[...drafts, ...ready].map((request) => placedItem(ctx, request, today))
		);
		const group = (landing: Stage) =>
			items.filter((item) => item.landing === landing).map((item) => item.item);
		const fiscalYear = fiscalYearOf(today);
		const approvedThisYear = approved.filter(
			(request) => fiscalYearOf(purchaseDate(request)) === fiscalYear
		);
		return {
			organization: {
				id: organization._id,
				name: organization.name,
				hasAllocations: organization.budgetLines.some((line) => line.allocations.length > 0)
			},
			readyToFill: group('ready').sort(byUpdatedAt),
			toFinish: group('to_finish').sort(byDaysLeft),
			afterEvent: group('after_event').sort(byFinishAfter),
			waitingOnEngage: group('filled').sort(byUpdatedAt),
			approvedThisYear: {
				count: approvedThisYear.length,
				total: roundCents(approvedThisYear.reduce((sum, request) => sum + request.totalAmount, 0))
			}
		};
	}
});

export const markSentBack = authedMutation({
	args: { purchaseRequestId: zid('purchaseRequests'), note: z.string() },
	returns: z.null(),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const request = await requireOwnedDoc(ctx, 'purchaseRequests', args.purchaseRequestId, owner);
		if (request.status !== 'ready' || request.lastFilledAt === null) {
			throw new Error('Only requests filled on Engage can be sent back.');
		}
		await ctx.db.patch(request._id, {
			status: 'draft',
			lastFilledAt: null,
			reviewerNote: args.note.trim(),
			updatedAt: Date.now()
		});
		return null;
	}
});

export const recentPurposes = authedQuery({
	args: { organizationId: zid('organizations'), excludeId: zid('purchaseRequests').optional() },
	returns: z.array(z.string()),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const requests = await ctx.db
			.query('purchaseRequests')
			.withIndex('by_owner_and_organizationSourceId_and_updatedAt', (q) =>
				q.eq('owner', owner).eq('organizationSourceId', args.organizationId)
			)
			.order('desc')
			.take(40);
		const seen = new Set<string>();
		const purposes: string[] = [];
		for (const request of requests) {
			if (request._id === args.excludeId) continue;
			const purpose = request.purpose?.trim() ?? '';
			const key = purpose.toLowerCase();
			if (purpose === '' || seen.has(key)) continue;
			seen.add(key);
			purposes.push(purpose);
			if (purposes.length === 5) break;
		}
		return purposes;
	}
});

async function placedItem(ctx: QueryCtx, request: Doc<'purchaseRequests'>, today: string) {
	const extractions = await requestExtractions(ctx, request);
	const reading = extractions.some(
		(extraction) => extraction.status === 'pending' || extraction.status === 'running'
	);
	const { readiness, checks } = await readinessWithChecks(ctx, request, extractions);
	const context = { reading, readinessReady: readiness.ready, today };
	const lifecycle = requestLifecycle(request, context);
	const landing =
		lifecycle.stage === 'reading'
			? requestLifecycle(request, { ...context, reading: false }).stage
			: lifecycle.stage;
	const nextStep = plainNextStep(readiness, checks);
	const item: BoardItem = {
		id: request._id,
		vendor: request.vendor,
		itemDescription: request.itemDescription,
		totalAmount: request.totalAmount,
		receiptDate: request.receiptDate ?? null,
		budgetLineItem: request.budgetLineItem,
		stage: lifecycle.stage,
		nextStep: nextStep ?? (request.reviewerNote === null ? null : sentBackStep),
		finishAfter: lifecycle.finishAfter,
		deadline: lifecycle.deadline,
		daysLeft: lifecycle.daysLeft,
		reading,
		receiptCount: request.receiptFileIds.length,
		lastFilledAt: request.lastFilledAt,
		updatedAt: request.updatedAt
	};
	return { landing, item };
}

function purchaseDate(request: Doc<'purchaseRequests'>) {
	return request.receiptDate ?? todayInEugene(request.createdAt);
}

function roundCents(value: number) {
	return Math.round(value * 100) / 100;
}

function byUpdatedAt(left: BoardItem, right: BoardItem) {
	return right.updatedAt - left.updatedAt;
}

function byDaysLeft(left: BoardItem, right: BoardItem) {
	if (left.daysLeft === right.daysLeft) return byUpdatedAt(left, right);
	if (left.daysLeft === null) return 1;
	if (right.daysLeft === null) return -1;
	return left.daysLeft - right.daysLeft;
}

function byFinishAfter(left: BoardItem, right: BoardItem) {
	if (left.finishAfter === right.finishAfter) return byUpdatedAt(left, right);
	if (left.finishAfter === null) return 1;
	if (right.finishAfter === null) return -1;
	return left.finishAfter < right.finishAfter ? -1 : 1;
}
