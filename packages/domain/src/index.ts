export type FundLetter = 'I' | 'E' | 'G' | 'N' | 'U' | 'D' | 'T';

export type DocumentKind =
	| 'receipt'
	| 'id_front'
	| 'id_back'
	| 'second_approval'
	| 'publicity'
	| 'brand_approval'
	| 'recipient_list';

export type PurchaseStatus = 'draft' | 'ready';
export type TypeOfPurchase =
	| 'personal_reimbursement'
	| 'internal_po'
	| 'external_po'
	| 'pcard'
	| 'co_sponsorship_payment'
	| 'service_agreement_or_purchase_order_for_service';
export type DocumentationCategory = 'asuo_funds';

export const fixedPersonalReimbursementReason = 'Other processes are too slow.';

export type StudentOrganization = {
	id: string;
	name: string;
	indexNumber: string;
	fundLetter: FundLetter;
	defaultBudgetLineItem: string;
};

export type Requester = {
	id: string;
	name: string;
	uo95: string;
	permanentAddress: string;
	idCardFrontFileId: string;
	idCardBackFileId: string;
	email?: string;
	phone?: string;
};

export type Purchaser = Requester;

export type EventDetails = {
	name: string;
	date: string;
	time: string;
	location: string;
	estimatedAttendance: number;
	publicityProofFileId: string | null;
};

export type Document = {
	id: string;
	kind: DocumentKind;
	filename: string;
	contentType: string;
	size: number;
	storageKey: string;
	url?: string | null;
	dataUrl?: string;
};

export type Recipient = {
	name: string;
	uo95: string;
	itemDescription: string;
	value: number;
	reason: string;
};

export type PurchaseRequest = {
	id: string;
	status: PurchaseStatus;
	typeOfPurchase: TypeOfPurchase;
	documentationCategories: DocumentationCategory[];
	organization: StudentOrganization;
	requester: Requester;
	purchaser: Purchaser;
	eventDetails: EventDetails;
	vendor: string;
	itemDescription: string;
	totalAmount: number;
	budgetLineItem: string;
	reimbursementReason: string;
	businessPurposeText: string;
	requesterIsPurchaser: boolean;
	receiptFileIds: string[];
	secondApprovalFileId: string | null;
	recipients: Recipient[];
	documents: Document[];
};

export type ReadinessIssue = {
	field: string;
	message: string;
};

export const samplePurchaseRequest: PurchaseRequest = {
	id: 'purchase_mort_garson',
	status: 'ready',
	typeOfPurchase: 'personal_reimbursement',
	documentationCategories: [],
	organization: {
		id: 'org_alc',
		name: 'Album Listening Club',
		indexNumber: 'OS353i',
		fundLetter: 'I',
		defaultBudgetLineItem: 'Event Expenses'
	},
	requester: {
		id: 'person_oliver',
		name: 'Oliver Boorstein',
		email: 'obo@uoregon.edu',
		phone: '9073104429',
		uo95: '952043159',
		permanentAddress: '11337 Our Rd, Anchorage, AK 99516',
		idCardFrontFileId: 'file_id_front',
		idCardBackFileId: 'file_id_back'
	},
	purchaser: {
		id: 'person_oliver',
		name: 'Oliver Boorstein',
		email: 'obo@uoregon.edu',
		phone: '9073104429',
		uo95: '952043159',
		permanentAddress: '11337 Our Rd, Anchorage, AK 99516',
		idCardFrontFileId: 'file_id_front',
		idCardBackFileId: 'file_id_back'
	},
	eventDetails: {
		name: 'Album Listening Club weekly event',
		date: '04/21',
		time: '6:30pm',
		location: 'McKenzie 240A',
		estimatedAttendance: 50,
		publicityProofFileId: 'file_publicity'
	},
	vendor: 'Amazon',
	itemDescription: 'Mort Garson music vinyl',
	totalAmount: 22.98,
	budgetLineItem: 'Event Expenses',
	reimbursementReason: fixedPersonalReimbursementReason,
	businessPurposeText:
		"Album Listening Club wishes to reimburse Oliver Boorstein because they purchased a Mort Garson music vinyl from Amazon for $22.98. This Mort Garson music vinyl was given as a gift to Aidan O'Donnell (951951840) for winning the Kahoot! Trivia during Album Listening Club weekly event which took place on 04/21 at 6:30pm in McKenzie 240A with about 50 students in attendance.",
	requesterIsPurchaser: true,
	receiptFileIds: ['file_receipt'],
	secondApprovalFileId: 'file_approval',
	recipients: [
		{
			name: "Aidan O'Donnell",
			uo95: '951951840',
			itemDescription: 'Mort Garson music vinyl',
			value: 22.98,
			reason: 'winning the Kahoot! Trivia'
		}
	],
	documents: [
		document('file_id_front', 'id_front', 'Oliver_ID_1.jpg', 'image/jpeg'),
		document('file_id_back', 'id_back', 'Oliver_ID_2.jpg', 'image/jpeg'),
		document('file_receipt', 'receipt', 'mort_garson_receipt.jpg', 'image/jpeg'),
		document('file_approval', 'second_approval', 'approval_email.pdf', 'application/pdf'),
		document('file_publicity', 'publicity', 'weekly_event_engage.pdf', 'application/pdf')
	]
};

export function formatMoney(amount: number) {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD'
	}).format(amount);
}

export function budgetLineText(purchaseRequest: PurchaseRequest) {
	return `${formatMoney(purchaseRequest.totalAmount)} from ${purchaseRequest.budgetLineItem}`;
}

export function reimbursementRecipientText(purchaseRequest: PurchaseRequest) {
	return `${purchaseRequest.purchaser.name}, ${purchaseRequest.purchaser.uo95}`;
}

export function recipientValueText(purchaseRequest: PurchaseRequest) {
	return enteredRecipients(purchaseRequest)
		.map((recipient) => `${recipient.name}, ${formatMoney(recipient.value)}`)
		.join('\n');
}

export function recipientIdText(purchaseRequest: PurchaseRequest) {
	return enteredRecipients(purchaseRequest)
		.map((recipient) => `${recipient.name}, ${recipient.uo95}`)
		.join('\n');
}

export function documentById(purchaseRequest: PurchaseRequest, documentId: string) {
	const document = purchaseRequest.documents.find((item) => item.id === documentId);
	if (document === undefined) {
		throw new Error(`Document not found: ${documentId}`);
	}
	return document;
}

export function generateBusinessPurpose(purchaseRequest: PurchaseRequest) {
	return purchaseRequest.businessPurposeText;
}

export function validatePurchaseReadiness(purchaseRequest: PurchaseRequest) {
	const issues: ReadinessIssue[] = [];

	if (purchaseRequest.typeOfPurchase !== 'personal_reimbursement') {
		issues.push({
			field: 'typeOfPurchase',
			message: 'Type of Purchase is not supported yet.'
		});
	}

	requireText(
		issues,
		'organization.name',
		purchaseRequest.organization.name,
		'Student organization name missing.'
	);
	requireText(
		issues,
		'organization.indexNumber',
		purchaseRequest.organization.indexNumber,
		'Index missing.'
	);
	requireText(issues, 'requester.name', purchaseRequest.requester.name, 'Requester name missing.');
	requireText(
		issues,
		'requester.email',
		purchaseRequest.requester.email ?? '',
		'Requester email missing.'
	);
	requireText(
		issues,
		'requester.phone',
		purchaseRequest.requester.phone ?? '',
		'Requester phone missing.'
	);
	requireText(issues, 'purchaser.name', purchaseRequest.purchaser.name, 'Purchaser name missing.');
	requireText(issues, 'purchaser.uo95', purchaseRequest.purchaser.uo95, 'Purchaser UO 95 missing.');
	requireText(
		issues,
		'purchaser.permanentAddress',
		purchaseRequest.purchaser.permanentAddress,
		'Purchaser address missing.'
	);
	requireText(
		issues,
		'eventDetails.name',
		purchaseRequest.eventDetails.name,
		'Event name missing.'
	);
	requireText(
		issues,
		'eventDetails.date',
		purchaseRequest.eventDetails.date,
		'Event date missing.'
	);
	requireText(
		issues,
		'eventDetails.time',
		purchaseRequest.eventDetails.time,
		'Event time missing.'
	);
	requireText(
		issues,
		'eventDetails.location',
		purchaseRequest.eventDetails.location,
		'Event location missing.'
	);
	if (purchaseRequest.eventDetails.estimatedAttendance <= 0) {
		issues.push({
			field: 'eventDetails.estimatedAttendance',
			message: 'Estimated attendance missing.'
		});
	}
	requireText(issues, 'vendor', purchaseRequest.vendor, 'Vendor missing.');
	requireText(
		issues,
		'itemDescription',
		purchaseRequest.itemDescription,
		'Item description missing.'
	);
	requireText(
		issues,
		'budgetLineItem',
		purchaseRequest.budgetLineItem,
		'Budget line item missing.'
	);
	requireText(
		issues,
		'businessPurposeText',
		purchaseRequest.businessPurposeText,
		'Business purpose missing.'
	);
	if (unresolvedToken(purchaseRequest.businessPurposeText)) {
		issues.push({
			field: 'businessPurposeText',
			message: 'Business purpose has unresolved variables.'
		});
	}

	if (purchaseRequest.totalAmount <= 0) {
		issues.push({ field: 'totalAmount', message: 'Total amount must be greater than zero.' });
	}

	if (purchaseRequest.receiptFileIds.length === 0) {
		issues.push({ field: 'receiptFileIds', message: 'Receipt document missing.' });
	}

	requireText(
		issues,
		'purchaser.idCardFrontFileId',
		purchaseRequest.purchaser.idCardFrontFileId,
		'ID card front document missing.'
	);
	requireText(
		issues,
		'purchaser.idCardBackFileId',
		purchaseRequest.purchaser.idCardBackFileId,
		'ID card back document missing.'
	);
	if (effectiveDocumentationCategories(purchaseRequest).includes('asuo_funds')) {
		requireText(
			issues,
			'eventDetails.publicityProofFileId',
			purchaseRequest.eventDetails.publicityProofFileId ?? '',
			'Publicity proof missing.'
		);
	}

	if (purchaseRequest.requesterIsPurchaser) {
		requireText(
			issues,
			'secondApprovalFileId',
			purchaseRequest.secondApprovalFileId ?? '',
			'Second approval missing.'
		);
	}

	return issues;
}

export function effectiveDocumentationCategories(purchaseRequest: PurchaseRequest) {
	const categories = new Set(purchaseRequest.documentationCategories);
	if (purchaseRequest.organization.fundLetter === 'I') categories.add('asuo_funds');
	return [...categories];
}

function enteredRecipients(purchaseRequest: PurchaseRequest) {
	return purchaseRequest.recipients.filter(
		(recipient) =>
			recipient.name.trim() !== '' ||
			recipient.uo95.trim() !== '' ||
			recipient.reason.trim() !== '' ||
			recipient.value > 0
	);
}

function requireText(issues: ReadinessIssue[], field: string, value: string, message: string) {
	if (value.trim() === '') {
		issues.push({ field, message });
	}
}

function unresolvedToken(value: string) {
	return /\{[A-Za-z][A-Za-z0-9]*\}/.test(value);
}

function document(id: string, kind: DocumentKind, filename: string, contentType: string): Document {
	return {
		id,
		kind,
		filename,
		contentType,
		size: 1,
		storageKey: `sample/${filename}`
	};
}
