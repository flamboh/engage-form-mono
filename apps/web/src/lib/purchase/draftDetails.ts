import type { Doc, Id } from '$convex/_generated/dataModel';

export type Recipient = { name: string; uo95: string; reason: string; value: number };
export type SavedData = {
	organizations: Doc<'organizations'>[];
	purchasers: Doc<'purchasers'>[];
	businessPurposeTemplates: Doc<'businessPurposeTemplates'>[];
};
export type TypeOfPurchase = Doc<'purchaseRequests'>['typeOfPurchase'];
export type DocumentationCategory = Doc<'purchaseRequests'>['documentationCategories'][number];
export type FundLetter = Doc<'organizations'>['fundLetter'];
export type BusinessPurposeSource = Doc<'purchaseRequests'>['businessPurposeSource'];
export type BusinessPurposeVariable = Extract<
	BusinessPurposeSource['parts'][number],
	{ kind: 'variable' }
>['variable'];

export type StudentOrganizationDetails = {
	name: string;
	indexNumber: string;
	fundLetter: FundLetter;
	budgetLines: string[];
	businessPurposeTemplate: string;
};
export type RequesterDetails = {
	id: Id<'users'>;
	name: string;
	email: string;
	phone: string;
	uo95: string;
	permanentAddress: string;
	idCardFrontFileId: Id<'files'>;
	idCardBackFileId: Id<'files'> | null;
};
export type PurchaserDetails = {
	id: Id<'users'> | Id<'purchasers'>;
	name: string;
	uo95: string;
	permanentAddress: string;
	idCardFrontFileId: Id<'files'>;
	idCardBackFileId: Id<'files'> | null;
};

const businessPurposeVariableLabels: Record<BusinessPurposeVariable, string> = {
	studentOrganization: 'Student Organization',
	purchaser: 'Purchaser',
	vendor: 'Vendor',
	itemDescription: 'Item Description',
	totalAmount: 'Total Amount',
	recipients: 'Recipients',
	recipientUo95Ids: 'Recipient UO 95 IDs',
	activityDate: 'Activity Date',
	activityTime: 'Activity Time',
	activityLocation: 'Activity Location',
	estimatedAttendance: 'Estimated Attendance',
	officeLocation: 'Office Location'
};

export function formatBusinessPurposeSource(source: BusinessPurposeSource) {
	return source.parts
		.map((part) => {
			if (part.kind === 'text') return part.text;
			return `{${businessPurposeVariableLabels[part.variable]}}`;
		})
		.join('');
}

export function userAsRequester(user: Doc<'users'>): RequesterDetails {
	return {
		id: user._id,
		name: user.name,
		email: user.studentEmail,
		phone: user.phone,
		uo95: user.uo95,
		permanentAddress: user.permanentAddress,
		idCardFrontFileId: user.idCardFrontFileId,
		idCardBackFileId: user.idCardBackFileId
	};
}

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
