import { z } from 'zod/v4';
import { zid } from 'convex-helpers/server/zod4';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { internal } from '../_generated/api';
import { fileDownloadUrl, requireOwnedKey } from '../files';
import {
	demoteIfNotReady,
	ownerFromIdentity,
	purchaseReadiness,
	renderBusinessPurpose,
	requireOwnedDoc,
	requireText
} from '../purchaseModel';
import { nullReturn } from '../purchaseZod';
import { documentSlot, requestView, reviewField } from '../requestView';
import {
	detachDocument,
	documentReadFailed,
	placeDocument,
	receiptRemovalChecks,
	requestDocuments,
	requestReviews,
	resolveReviewPatch,
	slotOf,
	type Slot
} from '../extraction/apply';
import { applyReceiptFields, extractionTimeoutMs } from '../extraction/jobs';
import { authedMutation, authedQuery } from './helpers';
import { presentPurchaseRequest } from './purchaseBuilder';

export const getRequestView = authedQuery({
	args: { id: zid('purchaseRequests') },
	returns: requestView,
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const request = await requireOwnedDoc(ctx, 'purchaseRequests', args.id, owner);
		const extractions = await ctx.db
			.query('extractions')
			.withIndex('by_purchaseRequestId', (q) => q.eq('purchaseRequestId', request._id))
			.take(50);
		const extractionsByFile = new Map(extractions.map((row) => [row.fileId, row]));
		const documents = [];
		for (const { fileId, slot } of requestDocuments(request)) {
			const file = await ctx.db.get(fileId);
			if (file === null || file.owner !== owner) continue;
			const extraction = extractionsByFile.get(fileId) ?? null;
			const url = await previewUrl(ctx, file);
			documents.push({
				fileId,
				kind: file.kind,
				filename: file.filename,
				contentType: file.contentType,
				previewUrl: url,
				reading: extraction?.status === 'pending' || extraction?.status === 'running',
				readFailed:
					documentReadFailed(slot, extraction) ||
					(slot === 'receipt' && url === null && extraction?.status !== 'done')
			});
		}
		const purchase = presentPurchaseRequest(request);
		return {
			purchase,
			documents,
			reading: documents.some((document) => document.reading),
			reviews: requestReviews(request, extractions),
			readiness: await purchaseReadiness(ctx, request),
			businessPurposeText: renderBusinessPurpose(purchase)
		};
	}
});

export const attachDocuments = authedMutation({
	args: {
		purchaseRequestId: zid('purchaseRequests'),
		fileIds: z.array(zid('files')),
		slot: z.union([documentSlot, z.literal('auto')])
	},
	returns: nullReturn,
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const request = await requireOwnedDoc(ctx, 'purchaseRequests', args.purchaseRequestId, owner);
		requireEditableDocuments(request);
		for (const fileId of args.fileIds) await requireOwnedDoc(ctx, 'files', fileId, owner);
		await attachFiles(ctx, request, args.fileIds, args.slot);
		return null;
	}
});

export const attachUpload = authedMutation({
	args: {
		purchaseRequestId: zid('purchaseRequests'),
		slot: z.union([documentSlot, z.literal('auto')]),
		r2Key: z.string(),
		filename: z.string(),
		contentType: z.string(),
		size: z.number()
	},
	returns: zid('files'),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const request = await requireOwnedDoc(ctx, 'purchaseRequests', args.purchaseRequestId, owner);
		requireEditableDocuments(request);
		requireText(args.filename, 'Filename missing.');
		await requireOwnedKey(owner, args.r2Key);
		const fileId = await ctx.db.insert('files', {
			kind: args.slot === 'auto' ? 'receipt' : args.slot,
			r2Key: args.r2Key,
			filename: args.filename,
			contentType: args.contentType,
			size: args.size,
			owner,
			createdAt: Date.now()
		});
		await attachFiles(ctx, request, [fileId], args.slot);
		return fileId;
	}
});

export const removeDocument = authedMutation({
	args: { purchaseRequestId: zid('purchaseRequests'), fileId: zid('files') },
	returns: nullReturn,
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const request = await requireOwnedDoc(ctx, 'purchaseRequests', args.purchaseRequestId, owner);
		const slot = slotOf(request, args.fileId);
		if (slot === null) return null;
		requireEditableDocuments(request);
		const extraction = await extractionForFile(ctx, args.fileId);
		await ctx.db.patch(request._id, {
			...detachDocument(request, args.fileId),
			...(slot === 'receipt' ? { receiptChecks: receiptRemovalChecks(request, extraction) } : {}),
			updatedAt: Date.now()
		});
		if (extraction !== null && extraction.purchaseRequestId === request._id) {
			await ctx.db.patch(extraction._id, { purchaseRequestId: null, updatedAt: Date.now() });
		}
		if (slot === 'receipt') await applyReceiptFields(ctx, request._id);
		await demoteIfNotReady(ctx, request._id);
		return null;
	}
});

export const retryExtraction = authedMutation({
	args: { purchaseRequestId: zid('purchaseRequests'), fileId: zid('files') },
	returns: nullReturn,
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const request = await requireOwnedDoc(ctx, 'purchaseRequests', args.purchaseRequestId, owner);
		requireEditableDocuments(request);
		if (slotOf(request, args.fileId) !== 'receipt') throw new Error('Only receipts can be read.');
		await requireOwnedDoc(ctx, 'files', args.fileId, owner);
		const existing = await extractionForFile(ctx, args.fileId);
		if (existing?.status === 'pending' || existing?.status === 'running') return null;
		await startExtraction(ctx, request, args.fileId, false, true);
		return null;
	}
});

export const resolveReview = authedMutation({
	args: {
		purchaseRequestId: zid('purchaseRequests'),
		field: reviewField,
		value: z.string()
	},
	returns: nullReturn,
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const request = await requireOwnedDoc(ctx, 'purchaseRequests', args.purchaseRequestId, owner);
		await ctx.db.patch(request._id, {
			...resolveReviewPatch(request, args.field, args.value),
			...(request.status === 'approved' ? { status: 'ready' as const } : {}),
			updatedAt: Date.now()
		});
		return null;
	}
});

async function attachFiles(
	ctx: MutationCtx,
	initial: Doc<'purchaseRequests'>,
	fileIds: Id<'files'>[],
	target: Slot | 'auto'
) {
	let request = initial;
	for (const [index, fileId] of [...new Set(fileIds)].entries()) {
		const explicit = target !== 'auto' && (target === 'receipt' || index === 0);
		const slot: Slot = explicit ? (target as Slot) : 'receipt';
		await ctx.db.patch(request._id, {
			...placeDocument(request, fileId, slot),
			updatedAt: Date.now()
		});
		if (explicit) await ctx.db.patch(fileId, { kind: slot });
		if (slot === 'receipt') await startExtraction(ctx, request, fileId, !explicit);
		const next = await ctx.db.get(request._id);
		if (next === null) throw new Error('Purchase request not found.');
		request = next;
	}
	await demoteIfNotReady(ctx, request._id);
}

async function startExtraction(
	ctx: MutationCtx,
	request: Doc<'purchaseRequests'>,
	fileId: Id<'files'>,
	classify: boolean,
	force = false
) {
	const now = Date.now();
	const existing = await extractionForFile(ctx, fileId);
	if (existing !== null && existing.status === 'done' && !classify && !force) {
		await ctx.db.patch(existing._id, { purchaseRequestId: request._id, updatedAt: now });
		await applyReceiptFields(ctx, request._id);
		return;
	}
	const fields = {
		owner: request.owner,
		fileId,
		purchaseRequestId: request._id,
		status: 'pending' as const,
		textSource: null,
		documentKind: null,
		vendor: null,
		totalAmount: null,
		receiptDate: null,
		items: [],
		error: null,
		attempt: (existing?.attempt ?? 0) + 1,
		updatedAt: now
	};
	let extractionId: Id<'extractions'>;
	if (existing === null) {
		extractionId = await ctx.db.insert('extractions', { ...fields, createdAt: now });
	} else {
		extractionId = existing._id;
		await ctx.db.patch(existing._id, fields);
	}
	await ctx.scheduler.runAfter(0, internal.extraction.jobs.extractFile, {
		extractionId,
		fileId,
		classify,
		attempt: fields.attempt
	});
	await ctx.scheduler.runAfter(extractionTimeoutMs, internal.extraction.jobs.expireExtraction, {
		extractionId,
		attempt: fields.attempt
	});
}

function requireEditableDocuments(request: Doc<'purchaseRequests'>) {
	if (request.status === 'approved') {
		throw new Error('This request is approved. Reopen it before changing documents.');
	}
}

async function extractionForFile(ctx: MutationCtx, fileId: Id<'files'>) {
	return await ctx.db
		.query('extractions')
		.withIndex('by_fileId', (q) => q.eq('fileId', fileId))
		.first();
}

async function previewUrl(ctx: Parameters<typeof fileDownloadUrl>[0], file: Doc<'files'>) {
	try {
		return await fileDownloadUrl(ctx, file);
	} catch {
		return null;
	}
}
