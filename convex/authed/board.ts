import { z } from 'zod/v4';
import { zid } from 'convex-helpers/server/zod4';
import type { Doc } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import { ownerFromIdentity, readinessWithChecks, requireOwnedDoc } from '../purchaseModel';
import { requestExtractions } from '../checks/load';
import type { PurchaseReadiness } from '../purchaseReadiness';
import { authedMutation, authedQuery } from './helpers';

const boardItem = z.object({
	id: zid('purchaseRequests'),
	vendor: z.string(),
	itemDescription: z.string(),
	totalAmount: z.number(),
	date: z.string(),
	receiptCount: z.number(),
	reading: z.boolean(),
	nextStep: z.string().nullable(),
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

export const organizationBoard = authedQuery({
	args: { organizationId: zid('organizations') },
	returns: z.object({
		organization: z.object({ id: zid('organizations'), name: z.string() }),
		needsInfo: z.array(boardItem),
		readyToFill: z.array(boardItem),
		waitingOnEngage: z.array(boardItem),
		approved: z.array(boardItem),
		hasMoreApproved: z.boolean()
	}),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const organization = await requireOwnedDoc(ctx, 'organizations', args.organizationId, owner);
		const byStatus = (status: Doc<'purchaseRequests'>['status'], limit: number) =>
			ctx.db
				.query('purchaseRequests')
				.withIndex('by_owner_and_organizationSourceId_and_status_and_updatedAt', (q) =>
					q.eq('owner', owner).eq('organizationSourceId', organization._id).eq('status', status)
				)
				.order('desc')
				.take(limit);
		const [drafts, ready, approved] = await Promise.all([
			byStatus('draft', 40),
			byStatus('ready', 40),
			byStatus('approved', 11)
		]);
		const [draftItems, readyItems] = await Promise.all([
			Promise.all(drafts.map((request) => checkedItem(ctx, request))),
			Promise.all(ready.map((request) => checkedItem(ctx, request)))
		]);
		const stillReady = ready.filter((_, index) => readyItems[index].nextStep === null);
		return {
			organization: { id: organization._id, name: organization.name },
			needsInfo: [...draftItems, ...readyItems.filter((item) => item.nextStep !== null)].sort(
				(left, right) => right.updatedAt - left.updatedAt
			),
			readyToFill: stillReady
				.filter((request) => request.lastFilledAt === null)
				.map((request) => baseItem(request)),
			waitingOnEngage: stillReady
				.filter((request) => request.lastFilledAt !== null)
				.map((request) => baseItem(request)),
			approved: approved.slice(0, 10).map((request) => baseItem(request)),
			hasMoreApproved: approved.length > 10
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

function baseItem(request: Doc<'purchaseRequests'>): BoardItem {
	return {
		id: request._id,
		vendor: request.vendor,
		itemDescription: request.itemDescription,
		totalAmount: request.totalAmount,
		date: request.receiptDate ?? request.activity.dates[0] ?? '',
		receiptCount: request.receiptFileIds.length,
		reading: false,
		nextStep: null,
		updatedAt: request.updatedAt
	};
}

async function checkedItem(ctx: QueryCtx, request: Doc<'purchaseRequests'>): Promise<BoardItem> {
	const extractions = await requestExtractions(ctx, request);
	const reading = extractions.some(
		(extraction) => extraction.status === 'pending' || extraction.status === 'running'
	);
	const { readiness, checks } = await readinessWithChecks(ctx, request, extractions);
	return {
		...baseItem(request),
		reading,
		nextStep: plainNextStep(readiness, checks)
	};
}
