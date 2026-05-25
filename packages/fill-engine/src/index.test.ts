import { expect, test } from 'vitest';
import { samplePurchaseRequest } from '../../domain/src/index.ts';
import { createFillPlan, detectStep, engageSchema } from './index.ts';

test('detects Engage steps by heading', () => {
	expect(detectStep('SOFS Request Organization Representation')).toBe('organizationRepresentation');
	expect(detectStep('Purpose, Instructions, and Authority to Spend')).toBe('purposeInstructions');
	expect(detectStep('SOFS Request Type of purchase')).toBe('purchaseType');
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
			labelIncludes: 'upload',
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
			labelIncludes: 'upload',
			files: [
				samplePurchaseRequest.documents.find(
					(document) => document.id === samplePurchaseRequest.eventDetails.publicityProofFileId
				)
			]
		}
	]);
});

test('skips self approval upload when requester is not purchaser', () => {
	expect(
		createFillPlan('selfApproval', {
			...samplePurchaseRequest,
			requesterIsPurchaser: false,
			secondApprovalFileId: null
		}).actions
	).toEqual([
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
