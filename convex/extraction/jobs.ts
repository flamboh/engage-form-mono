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
import { renderBusinessPurpose } from '../purchaseModel';
import { presentPurchaseRequest } from '../authed/purchaseBuilder';
import { detachDocument, placeDocument, receiptFieldsPatch, slotForKind, slotOf } from './apply';
import { documentKinds, type DocumentExtraction, type ParsedField } from './jev';
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

export const extractFile = internalAction({
	args: { extractionId: v.id('extractions'), classify: v.boolean() },
	handler: async (ctx, args) => {
		const started = await ctx.runMutation(internal.extraction.jobs.startExtraction, {
			extractionId: args.extractionId
		});
		if (started === null) return null;
		try {
			const env = extractionEnv();
			const { file, bytes } = await readFileBytes(ctx, started.fileId);
			const text = await readDocumentText(new Uint8Array(bytes), file.contentType, env);
			const result = await extractDocument(text, env);
			const purchaseRequestId = await ctx.runMutation(internal.extraction.jobs.finishExtraction, {
				extractionId: args.extractionId,
				classify: args.classify,
				textSource: text.source,
				result: storedResult(result)
			});
			if (purchaseRequestId === null || !isReceipt(result, args.classify)) return null;
			await refreshDecisions(ctx, env, purchaseRequestId, text.lines.join('\n')).catch((error) =>
				console.error('Default decisions failed', error)
			);
		} catch (error) {
			await ctx.runMutation(internal.extraction.jobs.failExtraction, {
				extractionId: args.extractionId,
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

export const startExtraction = internalMutation({
	args: { extractionId: v.id('extractions') },
	handler: async (ctx, args) => {
		const extraction = await ctx.db.get(args.extractionId);
		if (extraction === null || extraction.status === 'done') return null;
		await ctx.db.patch(args.extractionId, { status: 'running', updatedAt: Date.now() });
		return { fileId: extraction.fileId };
	}
});

export const failExtraction = internalMutation({
	args: { extractionId: v.id('extractions'), error: v.string() },
	handler: async (ctx, args) => {
		const extraction = await ctx.db.get(args.extractionId);
		if (extraction === null) return null;
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
		classify: v.boolean(),
		textSource: v.union(v.literal('text_layer'), v.literal('textract')),
		result: v.object({
			documentKind,
			looksLikePurchase: v.boolean(),
			vendor: v.union(extractedField, v.null()),
			totalAmount: v.union(extractedField, v.null()),
			receiptDate: v.union(extractedField, v.null()),
			items: v.array(v.string())
		})
	},
	handler: async (ctx, args) => {
		const extraction = await ctx.db.get(args.extractionId);
		if (extraction === null) return null;
		const slot = slotForKind(args.result.documentKind, args.result.looksLikePurchase);
		const receiptLike = isReceipt(args.result, args.classify);
		await ctx.db.patch(args.extractionId, {
			status: 'done',
			textSource: args.textSource,
			documentKind: args.result.documentKind,
			vendor: receiptLike ? args.result.vendor : null,
			totalAmount: receiptLike ? args.result.totalAmount : null,
			receiptDate: receiptLike ? args.result.receiptDate : null,
			items: receiptLike ? args.result.items : [],
			error: null,
			updatedAt: Date.now()
		});
		if (extraction.purchaseRequestId === null) return null;
		const request = await ctx.db.get(extraction.purchaseRequestId);
		if (request === null || request.owner !== extraction.owner) return null;
		if (args.classify) await classifyDocument(ctx, request, extraction.fileId, slot);
		await applyReceiptFields(ctx, request._id);
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
			businessPurpose: renderBusinessPurpose(presentPurchaseRequest(request)),
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
			sources.budgetLineItem = 'default';
		}
		if (sources.documentationCategories !== 'user' && args.categories.length > 0) {
			const kept = request.documentationCategories.filter((category) => category === 'asuo_funds');
			const categories = [...kept, ...args.categories];
			if (JSON.stringify(categories) !== JSON.stringify(request.documentationCategories)) {
				patch.documentationCategories = categories;
				sources.documentationCategories = 'default';
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
	if (current === null || current === slot) return;
	if (slot === null) {
		await ctx.db.patch(request._id, { ...detachDocument(request, fileId), updatedAt: Date.now() });
		return;
	}
	await ctx.db.patch(request._id, {
		...placeDocument(request, fileId, slot),
		updatedAt: Date.now()
	});
	const file = await ctx.db.get(fileId);
	if (file !== null) await ctx.db.patch(fileId, { kind: slot });
}

export async function applyReceiptFields(
	ctx: MutationCtx,
	purchaseRequestId: Id<'purchaseRequests'>
) {
	const request = await ctx.db.get(purchaseRequestId);
	if (request === null || request.status !== 'draft') return;
	const extractions = await ctx.db
		.query('extractions')
		.withIndex('by_purchaseRequestId', (q) => q.eq('purchaseRequestId', purchaseRequestId))
		.take(50);
	const patch = receiptFieldsPatch(request, extractions);
	if (Object.keys(patch).length === 0) return;
	await ctx.db.patch(purchaseRequestId, { ...patch, updatedAt: Date.now() });
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

function isReceipt(
	result: Pick<DocumentExtraction, 'documentKind' | 'looksLikePurchase'>,
	classify: boolean
) {
	return !classify || slotForKind(result.documentKind, result.looksLikePurchase) === 'receipt';
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
		items: result.items
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
	return { jevKey, aws: { accessKeyId, secretAccessKey, region } };
}
