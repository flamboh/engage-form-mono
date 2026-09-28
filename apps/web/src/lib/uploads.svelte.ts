import { api } from '$convex/_generated/api';
import type { Id } from '$convex/_generated/dataModel';
import type { DocumentSlot } from '$convex/requestView';
import { convexMutation, type ClerkSession } from '$lib/convex-http';
import { uploadFile } from '$lib/upload';

export type PendingUpload = {
	id: string;
	purchaseRequestId: Id<'purchaseRequests'>;
	file: File;
	slot: DocumentSlot | 'auto';
	error: string | null;
};

export const pendingUploads = $state<PendingUpload[]>([]);

export function pendingUploadsFor(purchaseRequestId: Id<'purchaseRequests'>) {
	return pendingUploads.filter((upload) => upload.purchaseRequestId === purchaseRequestId);
}

export function startUploads(
	session: ClerkSession,
	purchaseRequestId: Id<'purchaseRequests'>,
	files: File[],
	slot: DocumentSlot | 'auto'
) {
	const uploads = files.map((file) => ({
		id: crypto.randomUUID(),
		purchaseRequestId,
		file,
		slot,
		error: null
	}));
	pendingUploads.push(...uploads);
	return run(session, purchaseRequestId, uploads, slot);
}

async function run(
	session: ClerkSession,
	purchaseRequestId: Id<'purchaseRequests'>,
	uploads: PendingUpload[],
	slot: DocumentSlot | 'auto'
) {
	const kind = slot === 'auto' ? 'receipt' : slot;
	try {
		const fileIds = await Promise.all(
			uploads.map((upload) => uploadFile(session, kind, upload.file))
		);
		await convexMutation(session, api.authed.documents.attachDocuments, {
			purchaseRequestId,
			fileIds,
			slot
		});
		remove(uploads);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		for (const upload of uploads) {
			const pending = pendingUploads.find((item) => item.id === upload.id);
			if (pending) pending.error = message;
		}
	}
}

function remove(uploads: PendingUpload[]) {
	for (const upload of uploads) {
		const index = pendingUploads.findIndex((item) => item.id === upload.id);
		if (index !== -1) pendingUploads.splice(index, 1);
	}
}
