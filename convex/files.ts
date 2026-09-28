import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { internalQuery, type ActionCtx, type QueryCtx } from './_generated/server';
import { internal } from './_generated/api';
import { signedFileUrl } from './fileSigning';

const hour = 60 * 60 * 1000;

function filesConfig() {
	const baseUrl = process.env.FILES_BASE_URL;
	const secret = process.env.FILES_SIGNING_SECRET;
	if (!baseUrl || !secret) throw new Error('File storage is not configured.');
	return { baseUrl, secret };
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

export const getFile = internalQuery({
	args: { fileId: v.id('files') },
	handler: async (ctx, args) => await ctx.db.get(args.fileId)
});

export async function readFileBytes(ctx: ActionCtx, fileId: Id<'files'>) {
	const file = await ctx.runQuery(internal.files.getFile, { fileId });
	if (file === null) throw new Error('File not found.');
	const url = await fileDownloadUrl(ctx, file);
	if (url === null) throw new Error('File has no stored content.');
	const response = await fetch(url);
	if (!response.ok) throw new Error(`File download failed with ${response.status}.`);
	return { file, bytes: await response.arrayBuffer() };
}
