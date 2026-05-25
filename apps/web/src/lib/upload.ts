import { api } from '$convex/_generated/api';
import type { Id } from '$convex/_generated/dataModel';
import { convexMutation, type ClerkSession } from '$lib/convex-http';

type Kind =
	| 'receipt'
	| 'id_front'
	| 'id_back'
	| 'second_approval'
	| 'publicity'
	| 'catering_waiver'
	| 'printing_invoice'
	| 'building_manager_approval'
	| 'computer_price_quote'
	| 'brand_approval'
	| 'recipient_list';

export async function uploadFile(
	session: ClerkSession,
	kind: Kind,
	file: File
): Promise<Id<'files'>> {
	const uploadUrl = await convexMutation(session, api.authed.purchaseBuilder.generateUploadUrl, {});
	const response = await fetch(uploadUrl, {
		method: 'POST',
		headers: { 'Content-Type': file.type || 'application/octet-stream' },
		body: file
	});
	const { storageId } = (await response.json()) as { storageId: Id<'_storage'> };
	return await convexMutation(session, api.authed.purchaseBuilder.saveFile, {
		kind,
		storageId,
		filename: file.name,
		contentType: file.type || 'application/octet-stream',
		size: file.size
	});
}
