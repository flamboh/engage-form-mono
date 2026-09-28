import { api } from '$convex/_generated/api';
import type { Id } from '$convex/_generated/dataModel';
import type { DocumentSlot } from '$convex/requestView';
import { convexMutation, type ClerkSession } from '$lib/convex-http';
import { uploadFile } from '$lib/upload';

export type UploadSlot = DocumentSlot | 'auto';

export type PendingUpload = {
	id: string;
	purchaseRequestId: string;
	filename: string;
	contentType: string;
	objectUrl: string;
	slot: UploadSlot;
	status: 'uploading' | 'attaching' | 'attached' | 'failed';
	fileId: Id<'files'> | null;
	error: string;
};

export type UploadTransport = {
	upload(file: File, slot: UploadSlot): Promise<Id<'files'>>;
	attach(
		purchaseRequestId: Id<'purchaseRequests'>,
		fileIds: Id<'files'>[],
		slot: UploadSlot
	): Promise<void>;
};

const uploads = $state<PendingUpload[]>([]);
const sourceFiles: Record<string, { file: File; transport: UploadTransport }> = {};

export function convexUploadTransport(session: ClerkSession): UploadTransport {
	return {
		upload: (file, slot) => uploadFile(session, slot === 'auto' ? 'receipt' : slot, file),
		attach: async (purchaseRequestId, fileIds, slot) => {
			await convexMutation(session, api.authed.documents.attachDocuments, {
				purchaseRequestId,
				fileIds,
				slot
			});
		}
	};
}

export function startUploads(
	session: ClerkSession,
	purchaseRequestId: Id<'purchaseRequests'>,
	files: File[] | FileList,
	slot: UploadSlot = 'auto',
	transport: UploadTransport = convexUploadTransport(session)
) {
	const batch = Array.from(files).map((file) => {
		const id = crypto.randomUUID();
		sourceFiles[id] = { file, transport };
		uploads.push({
			id,
			purchaseRequestId,
			filename: file.name,
			contentType: file.type,
			objectUrl: URL.createObjectURL(file),
			slot,
			status: 'uploading',
			fileId: null,
			error: ''
		});
		return id;
	});
	void runBatch(purchaseRequestId, batch, slot);
	return batch;
}

export function uploadsFor(purchaseRequestId: string) {
	return uploads.filter((upload) => upload.purchaseRequestId === purchaseRequestId);
}

export function localPreviewFor(fileId: string) {
	return uploads.find((upload) => upload.fileId === fileId)?.objectUrl ?? null;
}

export function retryUpload(id: string) {
	const upload = find(id);
	if (upload === undefined) return;
	upload.status = 'uploading';
	upload.error = '';
	void runBatch(upload.purchaseRequestId as Id<'purchaseRequests'>, [id], upload.slot);
}

export function dismissUpload(id: string) {
	const index = uploads.findIndex((upload) => upload.id === id);
	if (index === -1) return;
	URL.revokeObjectURL(uploads[index].objectUrl);
	uploads.splice(index, 1);
	delete sourceFiles[id];
}

async function runBatch(
	purchaseRequestId: Id<'purchaseRequests'>,
	ids: string[],
	slot: UploadSlot
) {
	const uploaded = await Promise.all(ids.map((id) => uploadOne(id, slot)));
	const ready = uploaded.filter((item) => item !== null);
	if (ready.length === 0) return;
	const transport = ready[0].transport;
	try {
		await transport.attach(
			purchaseRequestId,
			ready.map((item) => item.fileId),
			slot
		);
		for (const item of ready) setStatus(item.id, 'attached');
	} catch (err) {
		for (const item of ready) fail(item.id, err);
	}
}

async function uploadOne(id: string, slot: UploadSlot) {
	const source = sourceFiles[id];
	const upload = find(id);
	if (source === undefined || upload === undefined) return null;
	try {
		const fileId = upload.fileId ?? (await source.transport.upload(source.file, slot));
		const current = find(id);
		if (current === undefined) return null;
		current.fileId = fileId;
		current.status = 'attaching';
		return { id, fileId, transport: source.transport };
	} catch (err) {
		fail(id, err);
		return null;
	}
}

function setStatus(id: string, status: PendingUpload['status']) {
	const upload = find(id);
	if (upload !== undefined) upload.status = status;
}

function fail(id: string, err: unknown) {
	const upload = find(id);
	if (upload === undefined) return;
	upload.status = 'failed';
	upload.error =
		err instanceof Error && /attach/i.test(err.message)
			? 'Uploaded, but couldn’t add it.'
			: 'Couldn’t upload.';
}

function find(id: string) {
	return uploads.find((upload) => upload.id === id);
}
