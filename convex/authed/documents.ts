import { z } from 'zod/v4';
import { zid } from 'convex-helpers/server/zod4';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { internal } from '../_generated/api';
import { fileDownloadUrl } from '../files';
import {
	ownerFromIdentity,
	purchaseReadiness,
	renderBusinessPurpose,
	requireOwnedDoc
} from '../purchaseModel';
import { nullReturn } from '../purchaseZod';
import { documentSlot, requestView, reviewField } from '../requestView';
import {
	detachDocument,
	placeDocument,
	requestDocuments,
	requestReviews,
	resolveReviewPatch,
	slotOf,
	type Slot
} from '../extraction/apply';
import { applyReceiptFields } from '../extraction/jobs';
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
		const readingFiles = new Set(
			extractions
				.filter((row) => row.status === 'pending' || row.status === 'running')
				.map((row) => row.fileId)
		);
		const documents = [];
		for (const { fileId } of requestDocuments(request)) {
			const file = await ctx.db.get(fileId);
			if (file === null || file.owner !== owner) continue;
			documents.push({
				fileId,
				kind: file.kind,
				filename: file.filename,
				contentType: file.contentType,
				previewUrl: await previewUrl(ctx, file),
				reading: readingFiles.has(fileId)
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
		let request = await requireOwnedDoc(ctx, 'purchaseRequests', args.purchaseRequestId, owner);
		const fileIds = [...new Set(args.fileIds)];
		for (const [index, fileId] of fileIds.entries()) {
			await requireOwnedDoc(ctx, 'files', fileId, owner);
			const explicit = args.slot !== 'auto' && (args.slot === 'receipt' || index === 0);
			const slot: Slot = explicit ? (args.slot as Slot) : 'receipt';
			await ctx.db.patch(request._id, {
				...placeDocument(request, fileId, slot),
				status: 'draft',
				updatedAt: Date.now()
			});
			if (explicit) await ctx.db.patch(fileId, { kind: slot });
			if (slot === 'receipt') await startExtraction(ctx, request, fileId, !explicit);
			request = await requireOwnedDoc(ctx, 'purchaseRequests', request._id, owner);
		}
		return null;
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
		await ctx.db.patch(request._id, {
			...detachDocument(request, args.fileId),
			status: 'draft',
			updatedAt: Date.now()
		});
		const extraction = await extractionForFile(ctx, args.fileId);
		if (extraction !== null && extraction.purchaseRequestId === request._id) {
			await ctx.db.patch(extraction._id, { purchaseRequestId: null, updatedAt: Date.now() });
		}
		if (slot === 'receipt') await applyReceiptFields(ctx, request._id);
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

async function startExtraction(
	ctx: MutationCtx,
	request: Doc<'purchaseRequests'>,
	fileId: Id<'files'>,
	classify: boolean
) {
	const now = Date.now();
	const existing = await extractionForFile(ctx, fileId);
	if (existing !== null && existing.status === 'done' && !classify) {
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
		classify
	});
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
