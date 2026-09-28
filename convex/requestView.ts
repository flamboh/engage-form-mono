import { z } from 'zod/v4';
import { zid } from 'convex-helpers/server/zod4';
import { fileKind, purchaseRequestDoc } from './purchaseZod';

export const documentSlot = z.enum([
	'receipt',
	'second_approval',
	'publicity',
	'catering_waiver',
	'printing_invoice',
	'building_manager_approval',
	'computer_price_quote',
	'brand_approval',
	'recipient_list'
]);

export const reviewField = z.enum(['vendor', 'totalAmount', 'receiptDate', 'itemDescription']);

export const requestDocument = z.object({
	fileId: zid('files'),
	kind: fileKind,
	filename: z.string(),
	contentType: z.string(),
	previewUrl: z.string().nullable(),
	reading: z.boolean(),
	readFailed: z.boolean()
});

export const requestReview = z.object({
	field: reviewField,
	value: z.string(),
	alternatives: z.array(z.string())
});

export const requestView = z.object({
	purchase: purchaseRequestDoc,
	documents: z.array(requestDocument),
	reading: z.boolean(),
	reviews: z.array(requestReview),
	readiness: z.object({
		ready: z.boolean(),
		sections: z.array(z.object({ section: z.string(), reasons: z.array(z.string()) }))
	}),
	businessPurposeText: z.string()
});

export type RequestView = z.infer<typeof requestView>;
export type RequestDocument = z.infer<typeof requestDocument>;
export type RequestReview = z.infer<typeof requestReview>;
export type DocumentSlot = z.infer<typeof documentSlot>;
