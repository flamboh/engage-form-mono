import {
	budgetLineText,
	documentById,
	effectiveDocumentationCategories,
	fixedPersonalReimbursementReason,
	generateBusinessPurpose,
	recipientIdText,
	recipientValueText,
	reimbursementRecipientText,
	type Document,
	type PurchaseRequest
} from '@engage-form/domain';

export type EngageStep =
	| 'formStart'
	| 'organizationRepresentation'
	| 'purposeInstructions'
	| 'about'
	| 'claims'
	| 'purchaseType'
	| 'reimbursement'
	| 'selfApproval'
	| 'documentation'
	| 'publicity'
	| 'gifts'
	| 'thankYou'
	| 'review'
	| 'unknown';

export type FillAction =
	| { type: 'text'; labelIncludes: string; value: string }
	| { type: 'textarea'; labelIncludes: string; value: string }
	| { type: 'checkbox'; labelIncludes: string; checked: boolean }
	| { type: 'radio'; labelIncludes: string }
	| { type: 'combobox'; labelIncludes: string; valueIncludes: string }
	| { type: 'select'; labelIncludes: string; valueIncludes: string }
	| { type: 'file'; labelIncludes: string; files: Document[] }
	| { type: 'stop'; message: string };

export type FillPlan = {
	step: EngageStep;
	actions: FillAction[];
};

type EngageField =
	| {
			type: 'text' | 'textarea' | 'combobox' | 'select';
			labelIncludes: string;
			resolve: (purchaseRequest: PurchaseRequest) => string;
	  }
	| {
			type: 'checkbox';
			labelIncludes: string | ((purchaseRequest: PurchaseRequest) => string);
			checked: boolean | ((purchaseRequest: PurchaseRequest) => boolean);
	  }
	| {
			type: 'radio';
			labelIncludes: string;
	  }
	| {
			type: 'file' | 'conditionalFile';
			labelIncludes: string;
			resolve: (purchaseRequest: PurchaseRequest) => Document[];
	  }
	| {
			type: 'receiptFiles';
	  }
	| {
			type: 'stop';
			message: string;
	  };

type EngageStepSchema = {
	step: EngageStep;
	headingIncludes: string[];
	fields: EngageField[];
};

export const engageSchema: EngageStepSchema[] = [
	{
		step: 'organizationRepresentation',
		headingIncludes: ['organization representation'],
		fields: [comboboxField('select the organization', (purchase) => purchase.organization.name)]
	},
	{
		step: 'purposeInstructions',
		headingIncludes: ['purpose, instructions, and authority to spend'],
		fields: [stopField('Instructions page reached. Continue to the next page.')]
	},
	{
		step: 'about',
		headingIncludes: ['about you, your org, and business purpose'],
		fields: [
			textField("Requestor's first and last name", (purchase) => purchase.requester.name),
			textField("Requestor's email address", (purchase) => purchase.requester.email ?? ''),
			textField("Requestor's phone number", (purchase) => purchase.requester.phone ?? ''),
			textField('Name of Student Organization', (purchase) => purchase.organization.name),
			textField('Student Organization Index', (purchase) => purchase.organization.indexNumber),
			checkboxField((purchase) => purchase.organization.fundLetter, true),
			textField('total amount', (purchase) => formatFormMoney(purchase.totalAmount)),
			textField('Line Item', budgetLineText),
			textareaField('business purpose', generateBusinessPurpose)
		]
	},
	{
		step: 'claims',
		headingIncludes: ['mandatory claims'],
		fields: [
			checkboxField('no alcohol', true),
			checkboxField('not host a raffle', true),
			checkboxField('ASUO rule', true),
			checkboxField('personal reimbursements', true)
		]
	},
	{
		step: 'purchaseType',
		headingIncludes: ['type of purchase'],
		fields: [radioField('Personal Reimbursement')]
	},
	{
		step: 'reimbursement',
		headingIncludes: ['personal reimbursement purchase info'],
		fields: [
			textField(
				'Why did you use the reimbursement process',
				() => fixedPersonalReimbursementReason
			),
			selectField('submitter of this form', () => 'Myself'),
			textField('name and UO 95 ID', reimbursementRecipientText),
			textField('permanent address', (purchase) => purchase.purchaser.permanentAddress),
			checkboxField('mailing address', true),
			fileField('UO ID CARD', (purchase) => [
				documentById(purchase, purchase.purchaser.idCardFrontFileId)
			]),
			fileField('UO ID CARD : Optional second upload', (purchase) => [
				documentById(purchase, purchase.purchaser.idCardBackFileId)
			]),
			receiptFilesField()
		]
	},
	{
		step: 'selfApproval',
		headingIncludes: ['seeking self reimbursement'],
		fields: [
			conditionalFileField('upload', (purchase) =>
				purchase.requesterIsPurchaser && purchase.secondApprovalFileId !== null
					? [documentById(purchase, purchase.secondApprovalFileId)]
					: []
			)
		]
	},
	{
		step: 'documentation',
		headingIncludes: ['documentation inquiry'],
		fields: [
			categoryCheckboxField('ASUO funds', 'asuo_funds'),
			categoryCheckboxField('food', 'food'),
			categoryCheckboxField('printing services', 'printing_services'),
			checkboxField('merchandise/apparel or gifts', true),
			categoryCheckboxField('office supplies/goods', 'office_supplies_goods')
		]
	},
	{
		step: 'publicity',
		headingIncludes: ['event open to all students'],
		fields: [
			conditionalFileField('upload', (purchase) =>
				purchase.eventDetails.publicityProofFileId === null
					? []
					: [documentById(purchase, purchase.eventDetails.publicityProofFileId)]
			)
		]
	},
	{
		step: 'gifts',
		headingIncludes: ['uo branding/apparel/gifts'],
		fields: [
			textareaField('per person gift/apparel/prize amount', recipientValueText),
			textareaField('name and 95# of the recipient', recipientIdText)
		]
	},
	{
		step: 'thankYou',
		headingIncludes: ['thank you'],
		fields: [stopField('Continue to review when ready.')]
	},
	{
		step: 'review',
		headingIncludes: ['review submission'],
		fields: [stopField('Review reached. Submit manually in Engage.')]
	},
	{
		step: 'formStart',
		headingIncludes: ['sofs request to purchase goods or services'],
		fields: [stopField('Form start reached. Continue to the first page.')]
	}
];

export function detectStep(headingText: string): EngageStep {
	const text = normalize(headingText);
	const step = engageSchema.find((item) =>
		item.headingIncludes.some((heading) => text.includes(heading))
	);

	if (step !== undefined) return step.step;

	return 'unknown';
}

export function createFillPlan(step: EngageStep, purchaseRequest: PurchaseRequest): FillPlan {
	const schema = engageSchema.find((item) => item.step === step);
	if (schema === undefined) {
		return { step, actions: [stop('Unknown Engage step. No fields filled.')] };
	}

	return {
		step,
		actions: schema.fields.flatMap((field) => resolveField(field, purchaseRequest))
	};
}

export function stepLabel(step: EngageStep) {
	switch (step) {
		case 'formStart':
			return 'Form start';
		case 'organizationRepresentation':
			return 'Student organization';
		case 'purposeInstructions':
			return 'Instructions';
		case 'about':
			return 'About/org/purpose';
		case 'claims':
			return 'Mandatory claims';
		case 'purchaseType':
			return 'Type of purchase';
		case 'reimbursement':
			return 'Reimbursement info';
		case 'selfApproval':
			return 'Second approval';
		case 'documentation':
			return 'Documentation inquiry';
		case 'publicity':
			return 'Event publicity';
		case 'gifts':
			return 'Merchandise/apparel/gifts';
		case 'thankYou':
			return 'Thank you';
		case 'review':
			return 'Review';
		case 'unknown':
			return 'Unknown';
	}
}

function resolveField(
	field: EngageField,
	purchaseRequest: PurchaseRequest
): FillAction | FillAction[] {
	if (field.type === 'text' || field.type === 'textarea') {
		return {
			type: field.type,
			labelIncludes: field.labelIncludes,
			value: field.resolve(purchaseRequest)
		};
	}

	if (field.type === 'combobox' || field.type === 'select') {
		return {
			type: field.type,
			labelIncludes: field.labelIncludes,
			valueIncludes: field.resolve(purchaseRequest)
		};
	}

	if (field.type === 'checkbox') {
		return {
			type: 'checkbox',
			labelIncludes:
				typeof field.labelIncludes === 'string'
					? field.labelIncludes
					: field.labelIncludes(purchaseRequest),
			checked: typeof field.checked === 'boolean' ? field.checked : field.checked(purchaseRequest)
		};
	}

	if (field.type === 'radio' || field.type === 'stop') {
		return field;
	}

	if (field.type === 'file') {
		return {
			type: 'file',
			labelIncludes: field.labelIncludes,
			files: field.resolve(purchaseRequest)
		};
	}

	if (field.type === 'conditionalFile') {
		const files = field.resolve(purchaseRequest);
		return files.length > 0
			? { type: 'file', labelIncludes: field.labelIncludes, files }
			: stop('No document required for this purchase request.');
	}

	if (field.type === 'receiptFiles') {
		return receiptDocumentActions(purchaseRequest);
	}

	throw new Error('Unsupported Engage field.');
}

function textField(
	labelIncludes: string,
	resolve: (purchaseRequest: PurchaseRequest) => string
): EngageField {
	return { type: 'text', labelIncludes, resolve };
}

function textareaField(
	labelIncludes: string,
	resolve: (purchaseRequest: PurchaseRequest) => string
): EngageField {
	return { type: 'textarea', labelIncludes, resolve };
}

function comboboxField(
	labelIncludes: string,
	resolve: (purchaseRequest: PurchaseRequest) => string
): EngageField {
	return { type: 'combobox', labelIncludes, resolve };
}

function selectField(
	labelIncludes: string,
	resolve: (purchaseRequest: PurchaseRequest) => string
): EngageField {
	return { type: 'select', labelIncludes, resolve };
}

function checkboxField(
	labelIncludes: string | ((purchaseRequest: PurchaseRequest) => string),
	checked: boolean | ((purchaseRequest: PurchaseRequest) => boolean)
): EngageField {
	return { type: 'checkbox', labelIncludes, checked };
}

function categoryCheckboxField(
	labelIncludes: string,
	category: PurchaseRequest['documentationCategories'][number]
): EngageField {
	return checkboxField(labelIncludes, (purchase) =>
		effectiveDocumentationCategories(purchase).includes(category)
	);
}

function radioField(labelIncludes: string): EngageField {
	return { type: 'radio', labelIncludes };
}

function fileField(
	labelIncludes: string,
	resolve: (purchaseRequest: PurchaseRequest) => Document[]
): EngageField {
	return { type: 'file', labelIncludes, resolve };
}

function conditionalFileField(
	labelIncludes: string,
	resolve: (purchaseRequest: PurchaseRequest) => Document[]
): EngageField {
	return { type: 'conditionalFile', labelIncludes, resolve };
}

function receiptFilesField(): EngageField {
	return { type: 'receiptFiles' };
}

function receiptDocumentActions(purchaseRequest: PurchaseRequest): FillAction[] {
	const labels = [
		'itemized receipt',
		'RECEIPT : Optional second upload',
		'RECEIPT : Optional third upload'
	];

	return purchaseRequest.receiptFileIds.slice(0, labels.length).map((fileId, index) => ({
		type: 'file',
		labelIncludes: labels[index],
		files: [documentById(purchaseRequest, fileId)]
	}));
}

function stopField(message: string): EngageField {
	return { type: 'stop', message };
}

function stop(message: string): FillAction {
	return { type: 'stop', message };
}

function normalize(value: string) {
	return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function formatFormMoney(amount: number) {
	return `$${amount.toFixed(2)}`;
}
