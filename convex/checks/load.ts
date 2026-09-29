import type { Doc } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import { requestDocuments } from '../extraction/apply';
import { effectiveDocumentationCategories } from '../purchaseCategories';
import type { ApprovalBasis, CheckInput } from './requestChecks';

type Request = Doc<'purchaseRequests'>;
export type Extraction = Pick<
	Doc<'extractions'>,
	'fileId' | 'status' | 'vendor' | 'totalAmount' | 'facts'
>;

export function approvalBasisOf(request: Request): ApprovalBasis {
	return {
		totalAmount: request.totalAmount,
		vendor: request.vendor,
		itemDescription: request.itemDescription,
		activity: activityOf(request)
	};
}

function activityOf(request: Request) {
	return {
		name: request.activity.name,
		dates: request.activity.dates,
		location: request.activity.location
	};
}

export function checkInputFrom(request: Request, extractions: Extraction[]): CheckInput {
	const categories = effectiveDocumentationCategories(request);
	const recipientsRequired =
		categories.includes('gifts_prizes') || categories.includes('merchandise_apparel');
	return {
		...approvalBasisOf(request),
		categories,
		purchaserIsSelf: request.purchaserSource.kind === 'self',
		activity: activityOf(request),
		recipients: recipientsRequired ? request.recipients : [],
		foodIndividuallyPackaged: request.foodIndividuallyPackaged ?? null,
		cateringWaiverAttached: request.cateringWaiverFileId !== null,
		confirmations: request.checkConfirmations ?? [],
		documents: requestDocuments(request).map(({ fileId, slot }) => {
			const extraction = extractions.find((row) => row.fileId === fileId && row.status === 'done');
			return {
				fileId,
				slot,
				vendor: extraction?.vendor?.value ?? '',
				total: extraction?.totalAmount?.value ?? '',
				facts: extraction?.facts ?? null
			};
		})
	};
}

export async function requestExtractions(ctx: QueryCtx, request: Request) {
	return await ctx.db
		.query('extractions')
		.withIndex('by_purchaseRequestId', (q) => q.eq('purchaseRequestId', request._id))
		.take(50);
}
