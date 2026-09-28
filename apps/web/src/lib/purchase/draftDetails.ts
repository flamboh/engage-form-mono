import type { Doc, Id } from '$convex/_generated/dataModel';

export type Recipient = { name: string; uo95: string; reason: string; value: number };
export type SavedData = {
	organizations: Doc<'organizations'>[];
	purchasers: Doc<'purchasers'>[];
	businessPurposeTemplates: Doc<'businessPurposeTemplates'>[];
};
export type DocumentationCategory = Doc<'purchaseRequests'>['documentationCategories'][number];
export type FundLetter = Doc<'organizations'>['fundLetter'];
export type PurchaserDetails = {
	id: Id<'users'> | Id<'purchasers'>;
	name: string;
	uo95: string;
	permanentAddress: string;
	idCardFrontFileId: Id<'files'>;
	idCardBackFileId: Id<'files'> | null;
};

export function userAsPurchaser(user: Doc<'users'>): PurchaserDetails {
	return {
		id: user._id,
		name: user.name,
		uo95: user.uo95,
		permanentAddress: user.permanentAddress,
		idCardFrontFileId: user.idCardFrontFileId,
		idCardBackFileId: user.idCardBackFileId
	};
}

export function savedPurchaserDetails(savedPurchaser: Doc<'purchasers'>): PurchaserDetails {
	return {
		id: savedPurchaser._id,
		name: savedPurchaser.name,
		uo95: savedPurchaser.uo95,
		permanentAddress: savedPurchaser.permanentAddress,
		idCardFrontFileId: savedPurchaser.idCardFrontFileId,
		idCardBackFileId: savedPurchaser.idCardBackFileId
	};
}
