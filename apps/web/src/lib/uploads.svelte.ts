import { api } from '$convex/_generated/api';
import type { Id } from '$convex/_generated/dataModel';
import type { DocumentSlot } from '$convex/requestView';
import { convexMutation, type ClerkSession } from '$lib/convex-http';
import { fileType, prepareForUpload, previewable, UploadProblem } from '$lib/imageConvert';
import { putFile, type StoredObject } from '$lib/upload';

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
	put(file: File): Promise<StoredObject>;
	attach(
		purchaseRequestId: Id<'purchaseRequests'>,
		stored: StoredObject,
		slot: UploadSlot
	): Promise<Id<'files'>>;
};

type Source = {
	file: File;
	prepared: File | null;
	stored: StoredObject | null;
	transport: UploadTransport;
	request: Promise<Id<'purchaseRequests'>>;
};

const attachedLingerMs = 10_000;
const uploads = $state<PendingUpload[]>([]);
const sources: Record<string, Source> = {};

export function convexUploadTransport(session: ClerkSession): UploadTransport {
	return {
		prepare: prepareForUpload,
		put: (file) => putFile(session, file),
		attach: (purchaseRequestId, stored, slot) =>
			convexMutation(session, api.authed.documents.attachUpload, {
				purchaseRequestId,
				slot,
				...stored
			})
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
	const ids = Array.from(files).map((file, index) => {
		const id = crypto.randomUUID();
		const fileSlot = slot === 'auto' || slot === 'receipt' || index === 0 ? slot : 'auto';
		const type = fileType(file);
		sources[id] = { file, prepared: null, stored: null, transport, request };
		uploads.push({
			id,
			purchaseRequestId: known,
			filename: file.name,
			contentType: type,
			objectUrl: previewable(type) ? URL.createObjectURL(file) : null,
			slot: fileSlot,
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
	for (const id of ids) void send(id, find(id)?.slot ?? slot);
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
	void send(id, upload.slot);
}

export function dismissUpload(id: string) {
	const index = uploads.findIndex((upload) => upload.id === id);
	if (index === -1) return;
	const objectUrl = uploads[index].objectUrl;
	if (objectUrl !== null) URL.revokeObjectURL(objectUrl);
	uploads.splice(index, 1);
	delete sources[id];
}

async function send(id: string, slot: UploadSlot) {
	const source = sources[id];
	if (source === undefined || find(id) === undefined) return;
	let stage: 'upload' | 'attach' = 'upload';
	try {
		if (source.stored === null) {
			source.prepared ??= await (source.transport.prepare?.(source.file) ?? source.file);
			useConvertedPreview(id, source.prepared);
			source.stored = await source.transport.put(source.prepared);
		}
		const current = find(id);
		if (current === undefined) return;
		current.status = 'attaching';
		stage = 'attach';
		const purchaseRequestId = await source.request;
		const fileId = await source.transport.attach(purchaseRequestId, source.stored, slot);
		const attached = find(id);
		if (attached === undefined) return;
		attached.fileId = fileId;
		markAttached(id);
	} catch (err) {
		fail(id, err, stage);
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
