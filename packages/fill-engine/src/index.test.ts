import { expect, test } from 'vitest';
import { samplePurchaseRequest } from '../../domain/src/index.ts';
import {
	choiceMatches,
	createFillPlan,
	detectStep,
	engageSchema,
	type FillAction,
	hasKeyword,
	isEngageFormUrl,
	normalizeLabel
} from './index.ts';

test('detects Engage steps by heading', () => {
	expect(detectStep('SOFS Request Organization Representation')).toBe('organizationRepresentation');
	expect(detectStep('Purpose, Instructions, and Authority to Spend')).toBe('purposeInstructions');
	expect(detectStep('SOFS Request Type of purchase')).toBe('purchaseType');
	expect(detectStep('SOFS Request Catering Waiver')).toBe('cateringWaiver');
	expect(detectStep('Engage - Review Submission')).toBe('review');
	expect(detectStep('SOFS Request to Purchase Goods or Services 2025-26')).toBe('formStart');
});

test('defines expected Engage steps', () => {
	expect(engageSchema.map((step) => step.step)).toEqual([
		'organizationRepresentation',
		'purposeInstructions',
		'about',
		'claims',
		'purchaseType',
		'reimbursement',
		'selfApproval',
		'documentation',
		'publicity',
		'cateringWaiver',
		'gifts',
		'thankYou',
		'review',
		'formStart'
	]);
});

test('creates organization representation fill plan', () => {
	const plan = createFillPlan('organizationRepresentation', samplePurchaseRequest);

	expect(plan.actions).toEqual([
		{
			type: 'combobox',
			labelIncludes: 'select the organization',
			valueIncludes: 'Album Listening Club'
		}
	]);
});

test('creates about-page fill plan', () => {
	const plan = createFillPlan('about', samplePurchaseRequest);

	expect(plan.actions).toContainEqual({
		type: 'text',
		labelIncludes: 'Name of Student Organization',
		value: 'Album Listening Club'
	});
	expect(plan.actions).toContainEqual({
		type: 'text',
		labelIncludes: "Requestor's first and last name",
		value: samplePurchaseRequest.requester.name
	});
});

test('uses purchaser data for reimbursement fields', () => {
	const purchase = {
		...samplePurchaseRequest,
		requesterIsPurchaser: false,
		purchaser: {
			...samplePurchaseRequest.purchaser,
			id: 'person_buyer',
			name: 'Different Buyer',
			uo95: '950000001',
			permanentAddress: '123 Buyer St, Eugene, OR'
		}
	};

	const plan = createFillPlan('reimbursement', purchase);

	expect(plan.actions).toContainEqual({
		type: 'select',
		labelIncludes: 'submitter of this form',
		valueIncludes: 'Another student'
	});
	expect(plan.actions).toContainEqual({
		type: 'text',
		labelIncludes: 'name and UO 95 ID',
		value: 'Different Buyer, 950000001'
	});
	expect(plan.actions).toContainEqual({
		type: 'text',
		labelIncludes: 'permanent address',
		value: '123 Buyer St, Eugene, OR'
	});
});

test('fills the fixed Personal Reimbursement reason', () => {
	const plan = createFillPlan('reimbursement', {
		...samplePurchaseRequest,
		reimbursementReason: 'Because I typed something else.'
	});

	expect(plan.actions).toContainEqual({
		type: 'text',
		labelIncludes: 'Why did you use the reimbursement process',
		value: 'Other processes are too slow.'
	});
});

test('selects Myself when requester is purchaser', () => {
	const plan = createFillPlan('reimbursement', samplePurchaseRequest);

	expect(plan.actions).toContainEqual({
		type: 'select',
		labelIncludes: 'submitter of this form',
		valueIncludes: 'Myself'
	});
});

test('fills Engage acknowledgements mechanically', () => {
	const plan = createFillPlan('claims', samplePurchaseRequest);

	expect(plan.actions).toEqual([
		{ type: 'checkbox', labelIncludes: 'no alcohol', checked: true },
		{ type: 'checkbox', labelIncludes: 'not host a raffle', checked: true },
		{ type: 'checkbox', labelIncludes: 'ASUO rule', checked: true },
		{ type: 'checkbox', labelIncludes: 'personal reimbursements', checked: true }
	]);
});

test('creates upload fill plans', () => {
	const reimbursement = createFillPlan('reimbursement', samplePurchaseRequest);
	expect(reimbursement.actions).toContainEqual({
		type: 'file',
		labelIncludes: 'UO ID CARD',
		files: [
			samplePurchaseRequest.documents.find(
				(document) => document.id === samplePurchaseRequest.purchaser.idCardFrontFileId
			)
		]
	});
	expect(reimbursement.actions).toContainEqual({
		type: 'file',
		labelIncludes: 'UO ID CARD : Optional second upload',
		files: [
			samplePurchaseRequest.documents.find(
				(document) => document.id === samplePurchaseRequest.purchaser.idCardBackFileId
			)
		]
	});
	expect(reimbursement.actions).toContainEqual({
		type: 'file',
		labelIncludes: 'itemized receipt',
		files: samplePurchaseRequest.documents.filter(
			(document) => document.id === samplePurchaseRequest.receiptFileIds[0]
		)
	});

	expect(createFillPlan('selfApproval', samplePurchaseRequest).actions).toEqual([
		{
			type: 'file',
			labelIncludes: 'authorized signer of your organization indicates',
			files: [
				samplePurchaseRequest.documents.find(
					(document) => document.id === samplePurchaseRequest.secondApprovalFileId
				)
			]
		}
	]);

	expect(createFillPlan('publicity', samplePurchaseRequest).actions).toEqual([
		{
			type: 'file',
			labelIncludes: 'proof that your event was promoted',
			files: [
				samplePurchaseRequest.documents.find(
					(document) => document.id === samplePurchaseRequest.publicityFileId
				)
			]
		}
	]);

	const cateringWaiver = {
		...samplePurchaseRequest.documents[0],
		id: 'file_catering_waiver',
		kind: 'catering_waiver' as const,
		filename: 'catering-waiver.pdf'
	};
	expect(
		createFillPlan('cateringWaiver', {
			...samplePurchaseRequest,
			cateringWaiverFileId: cateringWaiver.id,
			documents: [...samplePurchaseRequest.documents, cateringWaiver]
		}).actions
	).toEqual([
		{
			type: 'file',
			labelIncludes: 'upload your approved catering waiver',
			files: [cateringWaiver]
		}
	]);
});

test('skips optional second ID card upload when only one ID card document exists', () => {
	const plan = createFillPlan('reimbursement', {
		...samplePurchaseRequest,
		purchaser: {
			...samplePurchaseRequest.purchaser,
			idCardFrontFileId: 'file_id_document',
			idCardBackFileId: null
		},
		documents: [
			...samplePurchaseRequest.documents,
			{
				id: 'file_id_document',
				kind: 'id_front',
				filename: 'id-card.pdf',
				contentType: 'application/pdf',
				size: 1,
				url: 'https://files.example/id-card.pdf'
			}
		]
	});

	expect(plan.actions).toContainEqual({
		type: 'file',
		labelIncludes: 'UO ID CARD',
		files: [
			expect.objectContaining({
				id: 'file_id_document',
				kind: 'id_front'
			})
		]
	});
	expect(plan.actions).not.toContainEqual({
		type: 'file',
		labelIncludes: 'UO ID CARD : Optional second upload',
		files: expect.any(Array)
	});
});

function documentationChoice(categories: typeof samplePurchaseRequest.documentationCategories) {
	const plan = createFillPlan('documentation', {
		...samplePurchaseRequest,
		documentationCategories: categories,
		organization: { ...samplePurchaseRequest.organization, fundLetter: 'E' }
	});
	return (labelIncludes: string) =>
		plan.actions.find(
			(action): action is Extract<FillAction, { type: 'checkbox' }> =>
				action.type === 'checkbox' && action.labelIncludes === labelIncludes
		)?.checked;
}

test('checks None of the above only when no Documentation Category applies', () => {
	expect(documentationChoice([])('none of the above')).toBe(true);
	expect(documentationChoice([])('ASUO funds')).toBe(false);
	expect(documentationChoice(['food'])('none of the above')).toBe(false);
});

test('fills ASUO Funds when it is implicit from Fund Letter I', () => {
	const plan = createFillPlan('documentation', {
		...samplePurchaseRequest,
		documentationCategories: []
	});

	expect(plan.actions).toContainEqual({
		type: 'checkbox',
		labelIncludes: 'ASUO funds',
		keywords: ['asuo'],
		checked: true
	});
	expect(plan.actions).toContainEqual(
		expect.objectContaining({ labelIncludes: 'none of the above', checked: false })
	);
});

test('fills ASUO Funds when a non-I Fund Letter selects it', () => {
	expect(documentationChoice(['asuo_funds'])('ASUO funds')).toBe(true);
});

test('fills selected additive Documentation Categories', () => {
	const choice = documentationChoice(['food', 'printing_services', 'office_supplies_goods']);

	expect(choice('food')).toBe(true);
	expect(choice('printing')).toBe(true);
	expect(choice('office supplies')).toBe(true);
	expect(choice('gifts or logo designs')).toBe(false);
});

test('maps either Merchandise/Apparel or Gifts/Prizes to the Engage combined checkbox', () => {
	expect(documentationChoice(['merchandise_apparel'])('gifts or logo designs')).toBe(true);
	expect(documentationChoice(['gifts_prizes'])('gifts or logo designs')).toBe(true);
	expect(documentationChoice([])('gifts or logo designs')).toBe(false);
});

const documentationLabelSets = {
	'2026-27 live': [
		'Your event is using ASUO funds.',
		'Your event is having food.',
		'This PO involves printing services.',
		'This PO involves purchasing gifts or logo designs.',
		'This PO involves office supplies/goods.',
		'None of the above'
	],
	'2025-26': [
		'Your event is using ASUO funds.',
		'Your event is having food.',
		'This PO involves printing services.',
		'This PO involves designs for merchandise/apparel or gifts.',
		'This PO involves office supplies/goods.',
		'None of the above'
	],
	'Oxford comma and ampersands': [
		'Your event uses ASUO Funds',
		'Food & drinks will be served at your event',
		'This request involves Printing (UO Print Services)',
		'This PO involves designs for merchandise, apparel, and/or gifts.',
		'Office Supplies & Goods',
		'None of the above.'
	],
	'short labels': [
		'ASUO funds',
		'Food',
		'Printing services',
		'Gifts, prizes, or logo designs',
		'Office supplies/goods',
		'None of these apply'
	],
	'custom printed swag': [
		'Activity paid for with ASUO funds',
		'Food/beverages',
		'Print Services invoice or waiver',
		'Logo designs, merchandise/apparel, or gifts',
		'Office supplies-goods',
		'None'
	]
};

const documentationActions = createFillPlan('documentation', samplePurchaseRequest).actions.filter(
	(action): action is Extract<FillAction, { type: 'checkbox' }> => action.type === 'checkbox'
);

test('matches the live 2026-27 gifts or logo designs checkbox', () => {
	const merch = documentationActions.find(
		(action) => action.labelIncludes === 'gifts or logo designs'
	);
	expect(merch).toBeDefined();
	expect(choiceMatches('This PO involves purchasing gifts or logo designs.', merch!)).toBe(true);
	expect(
		documentationActions.filter((action) =>
			choiceMatches('This PO involves purchasing gifts or logo designs.', action)
		)
	).toEqual([merch]);
});

test.each(Object.entries(documentationLabelSets))(
	'matches each Documentation Inquiry checkbox to exactly one field (%s)',
	(_name, labels) => {
		for (const label of labels) {
			expect(
				documentationActions.filter((action) => choiceMatches(label, action)).length,
				label
			).toBe(1);
		}
		for (const action of documentationActions) {
			expect(
				labels.filter((label) => choiceMatches(label, action)).length,
				action.labelIncludes
			).toBe(1);
		}
	}
);

test('normalizes punctuation and conjunctions in labels', () => {
	expect(normalizeLabel('Merchandise/Apparel or Gifts')).toBe('merchandise apparel gifts');
	expect(normalizeLabel('merchandise, apparel, and/or gifts.')).toBe('merchandise apparel gifts');
	expect(normalizeLabel('Office Supplies & Goods')).toBe('office supplies goods');
	expect(normalizeLabel('UO ID CARD : Optional second-upload')).toBe(
		'uo id card optional second upload'
	);
	expect(hasKeyword('Gifts, prizes', 'gift')).toBe(true);
	expect(hasKeyword('Not for non-affiliates', 'none')).toBe(false);
});

test('detects the gifts step when its heading wording changes', () => {
	expect(detectStep('SOFS Request UO Branding/Apparel/Gifts')).toBe('gifts');
	expect(detectStep('SOFS Request Gifts and Logo Designs')).toBe('gifts');
	expect(detectStep('SOFS Request UO Branding, Apparel & Gifts')).toBe('gifts');
	expect(detectStep('SOFS Request Documentation Inquiry')).toBe('documentation');
	expect(detectStep('Something new')).toBe('unknown');
});

test('gives gifts step text fields fallback labels', () => {
	const plan = createFillPlan('gifts', {
		...samplePurchaseRequest,
		documentationCategories: ['gifts_prizes']
	});
	expect(plan.actions).toContainEqual(
		expect.objectContaining({
			type: 'textarea',
			labelIncludes: 'per person gift/apparel/prize amount',
			alternatives: expect.arrayContaining(['per person'])
		})
	);
	expect(plan.actions).toContainEqual(
		expect.objectContaining({
			type: 'textarea',
			labelIncludes: 'name and 95# of the recipient',
			alternatives: expect.arrayContaining(['95# of the recipient'])
		})
	);
});

test('skips self approval upload when requester is not purchaser', () => {
	expect(
		createFillPlan('selfApproval', {
			...samplePurchaseRequest,
			requesterIsPurchaser: false
		}).actions
	).toEqual([
		{
			type: 'stop',
			message: 'No document required for this purchase request.'
		}
	]);
});

test('skips catering waiver upload when no catering waiver is required', () => {
	expect(createFillPlan('cateringWaiver', samplePurchaseRequest).actions).toEqual([
		{
			type: 'stop',
			message: 'No document required for this purchase request.'
		}
	]);
});

test('creates separate upload actions for additional receipts', () => {
	const firstReceipt = samplePurchaseRequest.documents.find(
		(document) => document.id === 'file_receipt'
	);
	if (firstReceipt === undefined) throw new Error('Sample receipt missing.');

	const secondReceipt = { ...firstReceipt, id: 'file_receipt_2', filename: 'receipt_2.jpg' };
	const thirdReceipt = { ...firstReceipt, id: 'file_receipt_3', filename: 'receipt_3.jpg' };
	const purchase = {
		...samplePurchaseRequest,
		receiptFileIds: [firstReceipt.id, secondReceipt.id, thirdReceipt.id],
		documents: [...samplePurchaseRequest.documents, secondReceipt, thirdReceipt]
	};

	const plan = createFillPlan('reimbursement', purchase);

	expect(plan.actions).toContainEqual({
		type: 'file',
		labelIncludes: 'itemized receipt',
		files: [firstReceipt]
	});
	expect(plan.actions).toContainEqual({
		type: 'file',
		labelIncludes: 'RECEIPT : Optional second upload',
		files: [secondReceipt]
	});
	expect(plan.actions).toContainEqual({
		type: 'file',
		labelIncludes: 'RECEIPT : Optional third upload',
		files: [thirdReceipt]
	});
});

test('recognizes Engage submitter form pages', () => {
	expect(isEngageFormUrl('https://uoregon.campuslabs.com/engage/submitter/form/start/730239')).toBe(
		true
	);
	expect(
		isEngageFormUrl('https://uoregon.campuslabs.com/engage/submitter/form/step/1?Guid=abc')
	).toBe(true);
	expect(isEngageFormUrl('https://uoregon.campuslabs.com/engage/organizations')).toBe(false);
	expect(isEngageFormUrl('https://evil.example/engage/submitter/form/start/1')).toBe(false);
	expect(isEngageFormUrl(undefined)).toBe(false);
});
