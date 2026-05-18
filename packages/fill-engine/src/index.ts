import {
	budgetLineText,
	generateBusinessPurpose,
	purchaseFileById,
	recipientIdText,
	recipientValueText,
	reimbursementRecipientText,
	type PurchaseFile,
	type Purchase
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
	| { type: 'file'; labelIncludes: string; files: PurchaseFile[] }
	| { type: 'stop'; message: string };

export type FillPlan = {
	step: EngageStep;
	actions: FillAction[];
};

type RtpField =
	| {
			type: 'text' | 'textarea' | 'combobox' | 'select';
			labelIncludes: string;
			resolve: (purchase: Purchase) => string;
	  }
	| {
			type: 'checkbox';
			labelIncludes: string | ((purchase: Purchase) => string);
			checked: boolean;
	  }
	| {
			type: 'radio';
			labelIncludes: string;
	  }
	| {
			type: 'file' | 'conditionalFile';
			labelIncludes: string;
			resolve: (purchase: Purchase) => PurchaseFile[];
	  }
	| {
			type: 'receiptFiles';
	  }
	| {
			type: 'stop';
			message: string;
	  };

type RtpStepSchema = {
	step: EngageStep;
	headingIncludes: string[];
	fields: RtpField[];
};

export const rtpSchema: RtpStepSchema[] = [
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
				(purchase) => purchase.reimbursementReason
			),
			selectField('submitter of this form', () => 'Myself'),
			textField('name and UO 95 ID', reimbursementRecipientText),
			textField('permanent address', (purchase) => purchase.purchaser.permanentAddress),
			checkboxField('mailing address', true),
			fileField('UO ID CARD', (purchase) => [
				purchaseFileById(purchase, purchase.purchaser.idCardFrontFileId)
			]),
			fileField('UO ID CARD : Optional second upload', (purchase) => [
				purchaseFileById(purchase, purchase.purchaser.idCardBackFileId)
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
					? [purchaseFileById(purchase, purchase.secondApprovalFileId)]
					: []
			)
		]
	},
	{
		step: 'documentation',
		headingIncludes: ['documentation inquiry'],
		fields: [
			checkboxField('ASUO funds', true),
			checkboxField('food', false),
			checkboxField('printing services', false),
			checkboxField('merchandise/apparel or gifts', true),
			checkboxField('office supplies/goods', false),
			checkboxField('None of the above', false)
		]
	},
	{
		step: 'publicity',
		headingIncludes: ['event open to all students'],
		fields: [
			fileField('upload', (purchase) => [
				purchaseFileById(purchase, purchase.eventDetails.publicityProofFileId)
			])
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
	const step = rtpSchema.find((item) =>
		item.headingIncludes.some((heading) => text.includes(heading))
	);

	if (step !== undefined) return step.step;

	return 'unknown';
}

export function createFillPlan(step: EngageStep, purchase: Purchase): FillPlan {
	const schema = rtpSchema.find((item) => item.step === step);
	if (schema === undefined) {
		return { step, actions: [stop('Unknown Engage step. No fields filled.')] };
	}

	return { step, actions: schema.fields.flatMap((field) => resolveField(field, purchase)) };
}

export function stepLabel(step: EngageStep) {
	switch (step) {
		case 'formStart':
			return 'Form start';
		case 'organizationRepresentation':
			return 'Organization';
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
			return 'Self approval';
		case 'documentation':
			return 'Documentation inquiry';
		case 'publicity':
			return 'Event publicity';
		case 'gifts':
			return 'Gifts/apparel';
		case 'thankYou':
			return 'Thank you';
		case 'review':
			return 'Review';
		case 'unknown':
			return 'Unknown';
	}
}

function resolveField(field: RtpField, purchase: Purchase): FillAction | FillAction[] {
	if (field.type === 'text' || field.type === 'textarea') {
		return { type: field.type, labelIncludes: field.labelIncludes, value: field.resolve(purchase) };
	}

	if (field.type === 'combobox' || field.type === 'select') {
		return {
			type: field.type,
			labelIncludes: field.labelIncludes,
			valueIncludes: field.resolve(purchase)
		};
	}

	if (field.type === 'checkbox') {
		return {
			type: 'checkbox',
			labelIncludes:
				typeof field.labelIncludes === 'string'
					? field.labelIncludes
					: field.labelIncludes(purchase),
			checked: field.checked
		};
	}

	if (field.type === 'radio' || field.type === 'stop') {
		return field;
	}

	if (field.type === 'file') {
		return { type: 'file', labelIncludes: field.labelIncludes, files: field.resolve(purchase) };
	}

	if (field.type === 'conditionalFile') {
		const files = field.resolve(purchase);
		return files.length > 0
			? { type: 'file', labelIncludes: field.labelIncludes, files }
			: stop('No upload required for this purchase.');
	}

	if (field.type === 'receiptFiles') {
		return receiptFileActions(purchase);
	}

	throw new Error('Unsupported RTP field.');
}

function textField(labelIncludes: string, resolve: (purchase: Purchase) => string): RtpField {
	return { type: 'text', labelIncludes, resolve };
}

function textareaField(labelIncludes: string, resolve: (purchase: Purchase) => string): RtpField {
	return { type: 'textarea', labelIncludes, resolve };
}

function comboboxField(labelIncludes: string, resolve: (purchase: Purchase) => string): RtpField {
	return { type: 'combobox', labelIncludes, resolve };
}

function selectField(labelIncludes: string, resolve: (purchase: Purchase) => string): RtpField {
	return { type: 'select', labelIncludes, resolve };
}

function checkboxField(
	labelIncludes: string | ((purchase: Purchase) => string),
	checked: boolean
): RtpField {
	return { type: 'checkbox', labelIncludes, checked };
}

function radioField(labelIncludes: string): RtpField {
	return { type: 'radio', labelIncludes };
}

function fileField(
	labelIncludes: string,
	resolve: (purchase: Purchase) => PurchaseFile[]
): RtpField {
	return { type: 'file', labelIncludes, resolve };
}

function conditionalFileField(
	labelIncludes: string,
	resolve: (purchase: Purchase) => PurchaseFile[]
): RtpField {
	return { type: 'conditionalFile', labelIncludes, resolve };
}

function receiptFilesField(): RtpField {
	return { type: 'receiptFiles' };
}

function receiptFileActions(purchase: Purchase): FillAction[] {
	const labels = [
		'itemized receipt',
		'RECEIPT : Optional second upload',
		'RECEIPT : Optional third upload'
	];

	return purchase.receiptFileIds.slice(0, labels.length).map((fileId, index) => ({
		type: 'file',
		labelIncludes: labels[index],
		files: [purchaseFileById(purchase, fileId)]
	}));
}

function stopField(message: string): RtpField {
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
