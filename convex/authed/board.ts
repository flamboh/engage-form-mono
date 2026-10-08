import { z } from 'zod/v4';
import { zid } from 'convex-helpers/server/zod4';
import type { Doc } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import { fiscalYearOfDate, hasAllocations, requestFiscalYear } from '../budget';
import { splitsLabel } from '../funds';
import { requestLifecycle, todayInEugene, type Stage } from '../lifecycle';
import { ownerFromIdentity, readinessWithChecks, requireOwnedDoc } from '../purchaseModel';
import { requestExtractions } from '../checks/load';
import type { PurchaseReadiness } from '../purchaseReadiness';
import { requestReviews } from '../extraction/apply';
import {
	checkStep,
	checkStepTitles,
	reasonStep,
	sentBackStep,
	stage,
	stepOrder,
	type RequestCheck,
	type StepId
} from '../requestView';
import { authedMutation, authedQuery } from './helpers';

const boardItem = z.object({
	id: zid('purchaseRequests'),
	vendor: z.string(),
	itemDescription: z.string(),
	totalAmount: z.number(),
	receiptDate: z.string().nullable(),
	budgetLabel: z.string(),
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

export function plainNextStep(
	readiness: Pick<PurchaseReadiness, 'sections'>,
	checks: Pick<RequestCheck, 'severity' | 'title' | 'action' | 'slot'>[],
	unconfirmed: StepId[]
): string | null {
	const titles = new Set(checks.map((check) => check.title));
	const blocking = [
		...checks
			.filter((check) => check.severity === 'blocking')
			.map((check) => ({ step: checkStep(check), title: check.title })),
		...readiness.sections.flatMap((section) =>
			section.reasons
				.filter((reason) => !titles.has(reason))
				.map((reason) => reasonStep(section.section, reason))
		)
	];
	if (blocking.length === 0) return null;
	const confirms = checks.filter(
		(check) => check.severity === 'warning' && check.action === 'confirm'
	);
	for (const step of stepOrder) {
		const title =
			blocking.find((item) => item.step === step)?.title ??
			(unconfirmed.includes(step) ? checkStepTitles[step] : undefined) ??
			confirms.find((check) => checkStep(check) === step)?.title;
		if (title !== undefined) return title;
	}
	return null;
}

export function unconfirmedSteps(
	request: Pick<Doc<'purchaseRequests'>, 'fieldSources' | 'purchaserSource'>,
	reviewCount: number
): StepId[] {
	const sources = request.fieldSources ?? {};
	const defaulted = (source: string | undefined) => source === 'previous' || source === 'suggested';
	const steps: [StepId, boolean][] = [
		['receipt', reviewCount > 0],
		['categories', sources.documentationCategories !== 'user'],
		['event', defaulted(sources.activity)],
		['purchaser', request.purchaserSource.kind !== 'self' && defaulted(sources.purchaserSource)]
	];
	return steps.filter(([, open]) => open).map(([step]) => step);
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
		const fiscalYear = fiscalYearOfDate(today);
		const approvedThisYear = approved.filter(
			(request) => requestFiscalYear(request) === fiscalYear
		);
		return {
			organization: {
				id: organization._id,
				name: organization.name,
				hasAllocations: hasAllocations(organization)
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
	const nextStep = plainNextStep(
		readiness,
		checks,
		unconfirmedSteps(request, requestReviews(request, extractions).length)
	);
	const item: BoardItem = {
		id: request._id,
		vendor: request.vendor,
		itemDescription: request.itemDescription,
		totalAmount: request.totalAmount,
		receiptDate: request.receiptDate ?? null,
		budgetLabel: splitsLabel(request.budgetSplits),
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
