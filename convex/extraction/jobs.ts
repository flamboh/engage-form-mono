import { v } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import {
	internalAction,
	internalMutation,
	internalQuery,
	type ActionCtx,
	type MutationCtx
} from '../_generated/server';
import { internal } from '../_generated/api';
import { readFileBytes } from '../files';
import { demoteIfNotReady, renderBusinessPurpose } from '../purchaseModel';
import { isCurrentAttempt, placeDocument, receiptFieldsPatch, slotForKind, slotOf } from './apply';
import { documentKinds, type DocumentExtraction, type ParsedField } from './jev';
import { documentFacts } from './facts';
import { approvalBasisOf } from '../checks/load';
import { approvalBasisKey, withConfirmation } from '../checks/requestChecks';
import { decideDefaults, extractDocument, readDocumentText, type ExtractionEnv } from './pipeline';

const extractedField = v.object({
	value: v.string(),
	confident: v.boolean(),
	alternatives: v.array(v.string())
});

const documentKind = v.union(
	...(Object.keys(documentKinds) as (keyof typeof documentKinds)[]).map((kind) => v.literal(kind))
);

const suggestedCategory = v.union(
	v.literal('food'),
	v.literal('printing_services'),
	v.literal('office_supplies_goods'),
	v.literal('merchandise_apparel'),
	v.literal('gifts_prizes')
);

const attemptArg = v.optional(v.number());

export const extractFile = internalAction({
	args: {
		extractionId: v.id('extractions'),
		fileId: v.optional(v.id('files')),
		classify: v.boolean(),
		attempt: attemptArg
	},
	handler: async (ctx, args) => {
		const actionStart = Date.now();
		const elapsed = () => Date.now() - actionStart;
		const prefetch = args.fileId === undefined ? null : readFileBytes(ctx, args.fileId);
		prefetch?.catch(() => undefined);
		const started = await ctx.runMutation(internal.extraction.jobs.startExtraction, {
			extractionId: args.extractionId,
			attempt: args.attempt
		});
		if (started === null) return null;
		const timing: Record<string, number> = {
			queued: actionStart - started.queuedAt,
			claimed: elapsed()
		};
		try {
			const env = extractionEnv();
			const { file, bytes } = await (prefetch !== null && args.fileId === started.fileId
				? prefetch
				: readFileBytes(ctx, started.fileId));
			timing.downloaded = elapsed();
			const text = await readDocumentText(new Uint8Array(bytes), file.contentType, env);
			timing.read = elapsed();
			const result = await extractDocument(text, env);
			timing.extracted = elapsed();
			const purchaseRequestId = await ctx.runMutation(internal.extraction.jobs.finishExtraction, {
				extractionId: args.extractionId,
				attempt: args.attempt,
				classify: args.classify,
				textSource: text.source,
				result: storedResult(result)
			});
			timing.applied = elapsed();
			if (purchaseRequestId !== null) {
				await refreshDecisions(ctx, env, purchaseRequestId, text.lines.join('\n')).catch((error) =>
					console.error('Default decisions failed', error)
				);
				timing.decided = elapsed();
			}
			console.log(
				'Extraction timing',
				JSON.stringify({ ...timing, source: text.source, bytes: bytes.byteLength })
			);
		} catch (error) {
			await ctx.runMutation(internal.extraction.jobs.failExtraction, {
				extractionId: args.extractionId,
				attempt: args.attempt,
				error: error instanceof Error ? error.message.slice(0, 500) : 'Extraction failed.'
			});
		}
		return null;
	}
});

export const refreshDefaults = internalAction({
	args: { purchaseRequestId: v.id('purchaseRequests') },
	handler: async (ctx, args) => {
		await refreshDecisions(ctx, extractionEnv(), args.purchaseRequestId, '');
		return null;
	}
});

export const extractionTimeoutMs = 3 * 60 * 1000;

export const expireExtraction = internalMutation({
	args: { extractionId: v.id('extractions'), attempt: attemptArg },
	handler: async (ctx, args) => {
		const extraction = await ctx.db.get(args.extractionId);
		if (extraction === null || !isCurrentAttempt(extraction, args.attempt)) return null;
		if (extraction.status !== 'pending' && extraction.status !== 'running') return null;
		const remaining = extractionTimeoutMs - (Date.now() - extraction.updatedAt);
		if (remaining > 0) {
			await ctx.scheduler.runAfter(remaining, internal.extraction.jobs.expireExtraction, args);
			return null;
		}
		await ctx.db.patch(args.extractionId, {
			status: 'failed',
			error: 'Reading the document timed out.',
			updatedAt: Date.now()
		});
		return null;
	}
});

export const startExtraction = internalMutation({
	args: { extractionId: v.id('extractions'), attempt: attemptArg },
	handler: async (ctx, args) => {
		const extraction = await ctx.db.get(args.extractionId);
		if (extraction === null || extraction.status === 'done') return null;
		if (!isCurrentAttempt(extraction, args.attempt)) return null;
		await ctx.db.patch(args.extractionId, { status: 'running', updatedAt: Date.now() });
		return { fileId: extraction.fileId, queuedAt: extraction.updatedAt };
	}
});

export const failExtraction = internalMutation({
	args: { extractionId: v.id('extractions'), attempt: attemptArg, error: v.string() },
	handler: async (ctx, args) => {
		const extraction = await ctx.db.get(args.extractionId);
		if (extraction === null || !isCurrentAttempt(extraction, args.attempt)) return null;
		await ctx.db.patch(args.extractionId, {
			status: 'failed',
			error: args.error,
			updatedAt: Date.now()
		});
		return null;
	}
});

export const finishExtraction = internalMutation({
	args: {
		extractionId: v.id('extractions'),
		attempt: attemptArg,
		classify: v.boolean(),
		textSource: v.union(v.literal('text_layer'), v.literal('textract')),
		result: v.object({
			documentKind,
			looksLikePurchase: v.boolean(),
			vendor: v.union(extractedField, v.null()),
			totalAmount: v.union(extractedField, v.null()),
			receiptDate: v.union(extractedField, v.null()),
			items: v.array(v.string()),
			facts: documentFacts
		})
	},
	handler: async (ctx, args) => {
		const extraction = await ctx.db.get(args.extractionId);
		if (extraction === null || !isCurrentAttempt(extraction, args.attempt)) return null;
		const slot = slotForKind(args.result.documentKind, args.result.looksLikePurchase);
		await ctx.db.patch(args.extractionId, {
			status: 'done',
			textSource: args.textSource,
			documentKind: args.result.documentKind,
			vendor: args.result.vendor,
			totalAmount: args.result.totalAmount,
			receiptDate: args.result.receiptDate,
			items: args.result.items,
			facts: args.result.facts,
			error: null,
			updatedAt: Date.now()
		});
		if (extraction.purchaseRequestId === null) return null;
		const request = await ctx.db.get(extraction.purchaseRequestId);
		if (request === null || request.owner !== extraction.owner) return null;
		if (args.classify && request.status !== 'approved')
			await classifyDocument(ctx, request, extraction.fileId, slot);
		await applyReceiptFields(ctx, request._id);
		await demoteIfNotReady(ctx, request._id);
		const current = await ctx.db.get(request._id);
		if (current === null || slotOf(current, extraction.fileId) !== 'receipt') return null;
		return request._id;
	}
});

export const decisionContext = internalQuery({
	args: { purchaseRequestId: v.id('purchaseRequests') },
	handler: async (ctx, args) => {
		const request = await ctx.db.get(args.purchaseRequestId);
		if (request === null || request.status !== 'draft') return null;
		const sources = request.fieldSources ?? {};
		const decideBudget =
			sources.budgetLineItem !== 'user' && request.studentOrganization.budgetLines.length > 1;
		const decideCategories = sources.documentationCategories !== 'user';
		if (!decideBudget && !decideCategories) return null;
		if (request.vendor.trim() === '' && request.itemDescription.trim() === '') return null;
		return {
			vendor: request.vendor,
			itemDescription: request.itemDescription,
			businessPurpose: renderBusinessPurpose(request),
			budgetLines: decideBudget ? request.studentOrganization.budgetLines : []
		};
	}
});

export const applyDecisions = internalMutation({
	args: {
		purchaseRequestId: v.id('purchaseRequests'),
		budgetLine: v.union(v.object({ value: v.string(), confident: v.boolean() }), v.null()),
		categories: v.array(suggestedCategory)
	},
	handler: async (ctx, args) => {
		const request = await ctx.db.get(args.purchaseRequestId);
		if (request === null || request.status !== 'draft') return null;
		const sources = { ...(request.fieldSources ?? {}) };
		const patch: Partial<Doc<'purchaseRequests'>> = {};
		const budgetLine = args.budgetLine;
		if (
			budgetLine !== null &&
			sources.budgetLineItem !== 'user' &&
			request.studentOrganization.budgetLines.includes(budgetLine.value) &&
			budgetLine.value !== request.budgetLineItem &&
			(request.budgetLineItem === '' || budgetLine.confident)
		) {
			patch.budgetLineItem = budgetLine.value;
			sources.budgetLineItem = 'suggested';
		}
		if (sources.documentationCategories !== 'user' && args.categories.length > 0) {
			const kept = request.documentationCategories.filter((category) => category === 'asuo_funds');
			const categories = [...kept, ...args.categories];
			if (JSON.stringify(categories) !== JSON.stringify(request.documentationCategories)) {
				patch.documentationCategories = categories;
				sources.documentationCategories = 'suggested';
			}
		}
		if (Object.keys(patch).length === 0) return null;
		await ctx.db.patch(args.purchaseRequestId, {
			...patch,
			fieldSources: sources,
			updatedAt: Date.now()
		});
		return null;
	}
});

async function classifyDocument(
	ctx: MutationCtx,
	request: Doc<'purchaseRequests'>,
	fileId: Id<'files'>,
	slot: ReturnType<typeof slotForKind>
) {
	const current = slotOf(request, fileId);
	if (current === null || slot === null || current === slot) return;
	await ctx.db.patch(request._id, {
		...placeDocument(request, fileId, slot),
		...(slot === 'second_approval' ? approvalBasisPatch(request) : {}),
		updatedAt: Date.now()
	});
	const file = await ctx.db.get(fileId);
	if (file !== null) await ctx.db.patch(fileId, { kind: slot });
}

export function approvalBasisPatch(request: Doc<'purchaseRequests'>) {
	return {
		checkConfirmations: withConfirmation(request.checkConfirmations ?? [], {
			id: 'approval-recheck',
			key: approvalBasisKey(approvalBasisOf(request))
		})
	};
}

export async function applyReceiptFields(
	ctx: MutationCtx,
	purchaseRequestId: Id<'purchaseRequests'>
) {
	const request = await ctx.db.get(purchaseRequestId);
	if (request === null || request.status === 'approved') return;
	const extractions = await ctx.db
		.query('extractions')
		.withIndex('by_purchaseRequestId', (q) => q.eq('purchaseRequestId', purchaseRequestId))
		.take(50);
	const patch = receiptFieldsPatch(request, extractions);
	if (Object.keys(patch).length === 0) return;
	await ctx.db.patch(purchaseRequestId, { ...patch, updatedAt: Date.now() });
	await demoteIfNotReady(ctx, purchaseRequestId);
}

async function refreshDecisions(
	ctx: ActionCtx,
	env: ExtractionEnv,
	purchaseRequestId: Id<'purchaseRequests'>,
	receiptText: string
) {
	const context = await ctx.runQuery(internal.extraction.jobs.decisionContext, {
		purchaseRequestId
	});
	if (context === null) return;
	const decisions = await decideDefaults({ ...context, receiptText }, env);
	await ctx.runMutation(internal.extraction.jobs.applyDecisions, {
		purchaseRequestId,
		budgetLine: decisions.budgetLine,
		categories: decisions.categories
	});
}

function storedResult(result: DocumentExtraction) {
	const strip = (field: ParsedField | null) =>
		field === null
			? null
			: { value: field.value, confident: field.confident, alternatives: field.alternatives };
	return {
		documentKind: result.documentKind,
		looksLikePurchase: result.looksLikePurchase,
		vendor: strip(result.vendor),
		totalAmount: strip(result.totalAmount),
		receiptDate: strip(result.receiptDate),
		items: result.items,
		facts: result.facts
	};
}

function extractionEnv(): ExtractionEnv {
	const jevKey = process.env.TYPESAFE_AI_KEY;
	const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
	const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
	const region = process.env.AWS_REGION ?? 'us-west-2';
	if (!jevKey || !accessKeyId || !secretAccessKey) {
		throw new Error('Receipt reading is not configured.');
	}
	const sessionToken = process.env.AWS_SESSION_TOKEN || undefined;
	return { jevKey, aws: { accessKeyId, secretAccessKey, sessionToken, region } };
}
