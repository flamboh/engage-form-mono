import { z } from 'zod/v4';
import { zid } from 'convex-helpers/server/zod4';
import { nullReturn } from '../purchaseZod';
import { documentSlot, requestView, reviewField } from '../requestView';
import { authedMutation, authedQuery } from './helpers';

export const getRequestView = authedQuery({
	args: { id: zid('purchaseRequests') },
	returns: requestView,
	handler: async () => {
		throw new Error('getRequestView is not implemented yet.');
	}
});

export const attachDocuments = authedMutation({
	args: {
		purchaseRequestId: zid('purchaseRequests'),
		fileIds: z.array(zid('files')),
		slot: z.union([documentSlot, z.literal('auto')])
	},
	returns: nullReturn,
	handler: async () => {
		throw new Error('attachDocuments is not implemented yet.');
	}
});

export const removeDocument = authedMutation({
	args: { purchaseRequestId: zid('purchaseRequests'), fileId: zid('files') },
	returns: nullReturn,
	handler: async () => {
		throw new Error('removeDocument is not implemented yet.');
	}
});

export const resolveReview = authedMutation({
	args: {
		purchaseRequestId: zid('purchaseRequests'),
		field: reviewField,
		value: z.string()
	},
	returns: nullReturn,
	handler: async () => {
		throw new Error('resolveReview is not implemented yet.');
	}
});
