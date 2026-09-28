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
	const contentType = file.type || 'application/octet-stream';
	const { uploadUrl, r2Key } = await convexMutation(
		session,
		api.authed.purchaseBuilder.createUploadTicket,
		{ contentType, size: file.size }
	);
	const response = await fetch(uploadUrl, {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/octet-stream',
			'X-File-Name': encodeURIComponent(file.name)
		},
		body: file
	});
	if (!response.ok) throw new Error(`Upload failed with ${response.status}.`);
	return await convexMutation(session, api.authed.purchaseBuilder.saveFile, {
		kind,
		r2Key,
		filename: file.name,
		contentType,
		size: file.size
	});
}
