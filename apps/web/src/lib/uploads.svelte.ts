import { api } from '$convex/_generated/api';
import type { Id } from '$convex/_generated/dataModel';
import type { DocumentSlot } from '$convex/requestView';
import { convexMutation, type ClerkSession } from '$lib/convex-http';
import { fileType, prepareForUpload, previewable, UploadProblem } from '$lib/imageConvert';
import { uploadFile } from '$lib/upload';

export type UploadSlot = DocumentSlot | 'auto';

export type PendingUpload = {
	id: string;
	purchaseRequestId: string;
	filename: string;
	contentType: string;
	objectUrl: string | null;
	slot: UploadSlot;
	status: 'uploading' | 'attaching' | 'attached' | 'failed';
	fileId: Id<'files'> | null;
	error: string;
	retryable: boolean;
};

export type UploadTransport = {
	prepare?(file: File): Promise<File>;
	upload(file: File, slot: UploadSlot): Promise<Id<'files'>>;
	attach(
		purchaseRequestId: Id<'purchaseRequests'>,
		fileIds: Id<'files'>[],
		slot: UploadSlot
	): Promise<void>;
};

type Source = {
	file: File;
	prepared: File | null;
	transport: UploadTransport;
	request: Promise<Id<'purchaseRequests'>>;
};

const attachedLingerMs = 10_000;
const uploads = $state<PendingUpload[]>([]);
const sources: Record<string, Source> = {};

export function convexUploadTransport(session: ClerkSession): UploadTransport {
	return {
		prepare: prepareForUpload,
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
	purchaseRequestId: Id<'purchaseRequests'> | Promise<Id<'purchaseRequests'>>,
	files: File[] | FileList,
	slot: UploadSlot = 'auto',
	transport: UploadTransport = convexUploadTransport(session)
) {
	const request = Promise.resolve(purchaseRequestId);
	const known = typeof purchaseRequestId === 'string' ? purchaseRequestId : '';
	const ids = Array.from(files).map((file) => {
		const id = crypto.randomUUID();
		const type = fileType(file);
		sources[id] = { file, prepared: null, transport, request };
		uploads.push({
			id,
			purchaseRequestId: known,
			filename: file.name,
			contentType: type,
			objectUrl: previewable(type) ? URL.createObjectURL(file) : null,
			slot,
			status: 'uploading',
			fileId: null,
			error: '',
			retryable: true
		});
		return id;
	});
	request.then(
		(resolved) => {
			for (const id of ids) {
				const upload = find(id);
				if (upload !== undefined) upload.purchaseRequestId = resolved;
			}
		},
		() => {
			for (const id of ids) dismissUpload(id);
		}
	);
	void run(ids, slot);
	return ids;
}

export function uploadsFor(purchaseRequestId: string) {
	return uploads.filter((upload) => upload.purchaseRequestId === purchaseRequestId);
}

export function localPreviewFor(fileId: string) {
	return uploads.find((upload) => upload.fileId === fileId)?.objectUrl ?? null;
}

export function settleUploads(purchaseRequestId: string, serverFileIds: string[]) {
	for (const upload of uploadsFor(purchaseRequestId)) {
		if (
			upload.status === 'attached' &&
			upload.fileId !== null &&
			serverFileIds.includes(upload.fileId)
		) {
			dismissUpload(upload.id);
		}
	}
}

export function retryUpload(id: string) {
	const upload = find(id);
	if (upload === undefined || sources[id] === undefined) return;
	upload.status = 'uploading';
	upload.error = '';
	void run([id], upload.slot);
}

export function dismissUpload(id: string) {
	const index = uploads.findIndex((upload) => upload.id === id);
	if (index === -1) return;
	const objectUrl = uploads[index].objectUrl;
	if (objectUrl !== null) URL.revokeObjectURL(objectUrl);
	uploads.splice(index, 1);
	delete sources[id];
}

async function run(ids: string[], slot: UploadSlot) {
	if (slot === 'auto' || slot === 'receipt') {
		await Promise.all(ids.map(async (id) => attach(present([await uploadOne(id, slot)]), slot)));
		return;
	}
	await attach(present(await Promise.all(ids.map((id) => uploadOne(id, slot)))), slot);
}

type Uploaded = { id: string; fileId: Id<'files'>; source: Source };

function present(items: (Uploaded | null)[]) {
	return items.filter((item) => item !== null);
}

async function attach(items: Uploaded[], slot: UploadSlot) {
	if (items.length === 0) return;
	const { source } = items[0];
	try {
		const purchaseRequestId = await source.request;
		await source.transport.attach(
			purchaseRequestId,
			items.map((item) => item.fileId),
			slot
		);
		for (const item of items) markAttached(item.id);
	} catch (err) {
		for (const item of items) fail(item.id, err, 'attach');
	}
}

async function uploadOne(id: string, slot: UploadSlot): Promise<Uploaded | null> {
	const source = sources[id];
	const upload = find(id);
	if (source === undefined || upload === undefined) return null;
	try {
		if (upload.fileId === null) {
			source.prepared ??= await (source.transport.prepare?.(source.file) ?? source.file);
			useConvertedPreview(id, source.prepared);
			const fileId = await source.transport.upload(source.prepared, slot);
			const current = find(id);
			if (current === undefined) return null;
			current.fileId = fileId;
		}
		const current = find(id);
		if (current === undefined || current.fileId === null) return null;
		current.status = 'attaching';
		return { id, fileId: current.fileId, source };
	} catch (err) {
		fail(id, err, 'upload');
		return null;
	}
}

function useConvertedPreview(id: string, prepared: File) {
	const upload = find(id);
	const source = sources[id];
	if (upload === undefined || source === undefined || prepared === source.file) return;
	if (upload.contentType === prepared.type && upload.objectUrl !== null) return;
	if (upload.objectUrl !== null) URL.revokeObjectURL(upload.objectUrl);
	upload.contentType = prepared.type;
	upload.filename = prepared.name;
	upload.objectUrl = previewable(prepared.type) ? URL.createObjectURL(prepared) : null;
}

function markAttached(id: string) {
	const upload = find(id);
	if (upload === undefined) return;
	upload.status = 'attached';
	delete sources[id];
	setTimeout(() => {
		if (find(id)?.status === 'attached') dismissUpload(id);
	}, attachedLingerMs);
}

function fail(id: string, err: unknown, stage: 'upload' | 'attach') {
	const upload = find(id);
	if (upload === undefined) return;
	upload.status = 'failed';
	upload.retryable = !(err instanceof UploadProblem);
	upload.error =
		err instanceof UploadProblem
			? err.message
			: stage === 'attach'
				? 'Uploaded, but couldn’t add it.'
				: 'Couldn’t upload.';
}

function find(id: string) {
	return uploads.find((upload) => upload.id === id);
}
