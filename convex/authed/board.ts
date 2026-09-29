import { z } from 'zod/v4';
import { zid } from 'convex-helpers/server/zod4';
import type { Doc } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import { evaluatePurchaseReadiness, ownerFromIdentity, requireOwnedDoc } from '../purchaseModel';
import { authedQuery } from './helpers';

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

const nextStepRules: [RegExp, string][] = [
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

export function plainNextStep(reasons: string[]): string | null {
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
		const needsInfo = await Promise.all(drafts.map((request) => draftItem(ctx, request)));
		return {
			organization: { id: organization._id, name: organization.name },
			needsInfo,
			readyToFill: ready
				.filter((request) => request.lastFilledAt === null)
				.map((request) => baseItem(request)),
			waitingOnEngage: ready
				.filter((request) => request.lastFilledAt !== null)
				.map((request) => baseItem(request)),
			approved: approved.slice(0, 10).map((request) => baseItem(request)),
			hasMoreApproved: approved.length > 10
		};
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
		date: request.receiptDate ?? request.activityDate ?? '',
		receiptCount: request.receiptFileIds.length,
		reading: false,
		nextStep: null,
		updatedAt: request.updatedAt
	};
}

async function draftItem(ctx: QueryCtx, request: Doc<'purchaseRequests'>): Promise<BoardItem> {
	const extractions = await ctx.db
		.query('extractions')
		.withIndex('by_purchaseRequestId', (q) => q.eq('purchaseRequestId', request._id))
		.take(10);
	const reading = extractions.some(
		(extraction) => extraction.status === 'pending' || extraction.status === 'running'
	);
	const readiness = await evaluatePurchaseReadiness(request);
	return {
		...baseItem(request),
		reading,
		nextStep: plainNextStep(readiness.sections.flatMap((section) => section.reasons))
	};
}
