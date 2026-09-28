import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import {
	internalAction,
	internalQuery,
	type ActionCtx,
	type MutationCtx
} from './_generated/server';
import { internal } from './_generated/api';
import { ownerKeyPrefix, ownsKey, signedFileUrl, uploadContentType } from './fileSigning';

const minute = 60 * 1000;
const hour = 60 * minute;
export const maxUploadSize = 15 * 1024 * 1024;
const uploadTicketTtl = 10 * minute;
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

export async function fileDownloadUrl(file: Doc<'files'>) {
	const { baseUrl, secret } = filesConfig();
	const expiresAt = Math.ceil(Date.now() / hour) * hour + hour;
	return await signedFileUrl(baseUrl, secret, { action: 'get', key: file.r2Key, expiresAt });
}

export async function deleteStoredFile(ctx: MutationCtx, file: Doc<'files'>) {
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
	const url = await fileDownloadUrl(file);
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
