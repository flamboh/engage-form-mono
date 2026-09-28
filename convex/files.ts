import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import {
	internalAction,
	internalMutation,
	internalQuery,
	type ActionCtx,
	type MutationCtx,
	type QueryCtx
} from './_generated/server';
import { internal } from './_generated/api';
import { ownerKeyPrefix, ownsKey, signedFileUrl, uploadContentType } from './fileSigning';

const minute = 60 * 1000;
const hour = 60 * minute;
export const maxUploadSize = 15 * 1024 * 1024;
const uploadTicketTtl = 10 * minute;
const migrationBatchSize = 25;
const downloadTimeoutMs = 20_000;

function filesConfig() {
	const baseUrl = process.env.FILES_BASE_URL;
	const secret = process.env.FILES_SIGNING_SECRET;
	if (!baseUrl || !secret) throw new Error('File storage is not configured.');
	return { baseUrl, secret };
}

export async function issueUploadTicket(owner: string, contentType: string, size: number) {
	if (size > maxUploadSize) throw new Error('File is larger than 15 MB.');
	const normalizedContentType = uploadContentType(contentType);
	const { baseUrl, secret } = filesConfig();
	const r2Key = `${await ownerKeyPrefix(owner)}/${crypto.randomUUID()}`;
	const uploadUrl = await signedFileUrl(baseUrl, secret, {
		action: 'put',
		key: r2Key,
		expiresAt: Date.now() + uploadTicketTtl,
		contentType: normalizedContentType,
		maxSize: maxUploadSize
	});
	return { uploadUrl, r2Key };
}

export async function requireOwnedKey(owner: string, r2Key: string) {
	if (!ownsKey(await ownerKeyPrefix(owner), r2Key)) throw new Error('File not found.');
}

export async function fileDownloadUrl(ctx: QueryCtx | ActionCtx, file: Doc<'files'>) {
	if (file.r2Key !== undefined) {
		const { baseUrl, secret } = filesConfig();
		const expiresAt = Math.ceil(Date.now() / hour) * hour + hour;
		return await signedFileUrl(baseUrl, secret, { action: 'get', key: file.r2Key, expiresAt });
	}
	if (file.storageId !== undefined) return await ctx.storage.getUrl(file.storageId);
	return null;
}

export async function deleteStoredFile(ctx: MutationCtx, file: Doc<'files'>) {
	if (file.storageId !== undefined) await ctx.storage.delete(file.storageId);
	if (file.r2Key !== undefined)
		await ctx.scheduler.runAfter(0, internal.files.deleteObject, { key: file.r2Key });
	await ctx.db.delete(file._id);
}

export const getFile = internalQuery({
	args: { fileId: v.id('files') },
	handler: async (ctx, args) => await ctx.db.get(args.fileId)
});

export async function readFileBytes(ctx: ActionCtx, fileId: Id<'files'>) {
	const file = await ctx.runQuery(internal.files.getFile, { fileId });
	if (file === null) throw new Error('File not found.');
	const url = await fileDownloadUrl(ctx, file);
	if (url === null) throw new Error('File has no stored content.');
	const response = await fetch(url, { signal: AbortSignal.timeout(downloadTimeoutMs) });
	if (!response.ok) throw new Error(`File download failed with ${response.status}.`);
	return { file, bytes: await response.arrayBuffer() };
}

export const deleteObject = internalAction({
	args: { key: v.string() },
	returns: v.null(),
	handler: async (_ctx, args) => {
		const { baseUrl, secret } = filesConfig();
		const url = await signedFileUrl(baseUrl, secret, {
			action: 'delete',
			key: args.key,
			expiresAt: Date.now() + uploadTicketTtl
		});
		const response = await fetch(url, {
			method: 'DELETE',
			signal: AbortSignal.timeout(downloadTimeoutMs)
		});
		if (!response.ok && response.status !== 404)
			throw new Error(`File delete failed with ${response.status}.`);
		return null;
	}
});

type LegacyFilesPage = { files: Doc<'files'>[]; cursor: string; isDone: boolean };

export const legacyFilesPage = internalQuery({
	args: { cursor: v.union(v.string(), v.null()) },
	handler: async (ctx, args): Promise<LegacyFilesPage> => {
		const page = await ctx.db
			.query('files')
			.paginate({ cursor: args.cursor, numItems: migrationBatchSize });
		return {
			files: page.page.filter((file) => file.storageId !== undefined && file.r2Key === undefined),
			cursor: page.continueCursor,
			isDone: page.isDone
		};
	}
});

export const finishLegacyFileMigration = internalMutation({
	args: { fileId: v.id('files'), storageId: v.id('_storage'), r2Key: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const file = await ctx.db.get(args.fileId);
		if (file === null || file.storageId !== args.storageId) return null;
		await ctx.db.patch(args.fileId, { r2Key: args.r2Key, storageId: undefined });
		await ctx.storage.delete(args.storageId);
		return null;
	}
});

export const migrateLegacyFiles = internalAction({
	args: { cursor: v.optional(v.union(v.string(), v.null())) },
	returns: v.object({ migrated: v.number(), isDone: v.boolean() }),
	handler: async (ctx, args): Promise<{ migrated: number; isDone: boolean }> => {
		const { baseUrl, secret } = filesConfig();
		const page: LegacyFilesPage = await ctx.runQuery(internal.files.legacyFilesPage, {
			cursor: args.cursor ?? null
		});
		for (const file of page.files) {
			const storageId = file.storageId;
			if (storageId === undefined) continue;
			const blob = await ctx.storage.get(storageId);
			if (blob === null) continue;
			const key = `${await ownerKeyPrefix(file.owner)}/${crypto.randomUUID()}`;
			const uploadUrl = await signedFileUrl(baseUrl, secret, {
				action: 'put',
				key,
				expiresAt: Date.now() + uploadTicketTtl,
				contentType: file.contentType,
				maxSize: Math.max(maxUploadSize, blob.size)
			});
			const response = await fetch(uploadUrl, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/octet-stream',
					'Content-Length': String(blob.size),
					'X-File-Name': encodeURIComponent(file.filename)
				},
				body: blob
			});
			if (!response.ok) throw new Error(`Migrating ${file._id} failed with ${response.status}.`);
			await ctx.runMutation(internal.files.finishLegacyFileMigration, {
				fileId: file._id,
				storageId,
				r2Key: key
			});
		}
		if (!page.isDone)
			await ctx.scheduler.runAfter(0, internal.files.migrateLegacyFiles, { cursor: page.cursor });
		return { migrated: page.files.length, isDone: page.isDone };
	}
});
