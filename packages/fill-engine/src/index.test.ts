import { expect, test } from 'vitest';
import { samplePurchase } from '../../domain/src/index.ts';
import { createFillPlan, detectStep, rtpSchema } from './index.ts';

test('detects Engage steps by heading', () => {
	expect(detectStep('SOFS Request Organization Representation')).toBe('organizationRepresentation');
	expect(detectStep('Purpose, Instructions, and Authority to Spend')).toBe('purposeInstructions');
	expect(detectStep('SOFS Request Type of purchase')).toBe('purchaseType');
	expect(detectStep('Engage - Review Submission')).toBe('review');
	expect(detectStep('SOFS Request to Purchase Goods or Services 2025-26')).toBe('formStart');
});

test('defines expected RTP steps', () => {
	expect(rtpSchema.map((step) => step.step)).toEqual([
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
	const plan = createFillPlan('organizationRepresentation', samplePurchase);

	expect(plan.actions).toEqual([
		{
			type: 'combobox',
			labelIncludes: 'select the organization',
			valueIncludes: 'Album Listening Club'
		}
	]);
});

test('creates about-page fill plan', () => {
	const plan = createFillPlan('about', samplePurchase);

	expect(plan.actions).toContainEqual({
		type: 'text',
		labelIncludes: 'Name of Student Organization',
		value: 'Album Listening Club'
	});
	expect(plan.actions).toContainEqual({
		type: 'text',
		labelIncludes: "Requestor's first and last name",
		value: samplePurchase.requester.name
	});
});

test('uses purchaser data for reimbursement fields', () => {
	const purchase = {
		...samplePurchase,
		requesterIsPurchaser: false,
		purchaser: {
			...samplePurchase.purchaser,
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

test('creates upload fill plans', () => {
	const reimbursement = createFillPlan('reimbursement', samplePurchase);
	expect(reimbursement.actions).toContainEqual({
		type: 'file',
		labelIncludes: 'UO ID CARD',
		files: [
			samplePurchase.files.find((file) => file.id === samplePurchase.purchaser.idCardFrontFileId)
		]
	});
	expect(reimbursement.actions).toContainEqual({
		type: 'file',
		labelIncludes: 'UO ID CARD : Optional second upload',
		files: [
			samplePurchase.files.find((file) => file.id === samplePurchase.purchaser.idCardBackFileId)
		]
	});
	expect(reimbursement.actions).toContainEqual({
		type: 'file',
		labelIncludes: 'itemized receipt',
		files: samplePurchase.files.filter((file) => file.id === samplePurchase.receiptFileIds[0])
	});

	expect(createFillPlan('selfApproval', samplePurchase).actions).toEqual([
		{
			type: 'file',
			labelIncludes: 'upload',
			files: [samplePurchase.files.find((file) => file.id === samplePurchase.secondApprovalFileId)]
		}
	]);

	expect(createFillPlan('publicity', samplePurchase).actions).toEqual([
		{
			type: 'file',
			labelIncludes: 'upload',
			files: [
				samplePurchase.files.find(
					(file) => file.id === samplePurchase.eventDetails.publicityProofFileId
				)
			]
		}
	]);
});

test('skips self approval upload when requester is not purchaser', () => {
	expect(
		createFillPlan('selfApproval', {
			...samplePurchase,
			requesterIsPurchaser: false,
			secondApprovalFileId: null
		}).actions
	).toEqual([
		{
			type: 'stop',
			message: 'No upload required for this purchase.'
		}
	]);
});

test('creates separate upload actions for additional receipts', () => {
	const firstReceipt = samplePurchase.files.find((file) => file.id === 'file_receipt');
	if (firstReceipt === undefined) throw new Error('Sample receipt missing.');

	const secondReceipt = { ...firstReceipt, id: 'file_receipt_2', filename: 'receipt_2.jpg' };
	const thirdReceipt = { ...firstReceipt, id: 'file_receipt_3', filename: 'receipt_3.jpg' };
	const purchase = {
		...samplePurchase,
		receiptFileIds: [firstReceipt.id, secondReceipt.id, thirdReceipt.id],
		files: [...samplePurchase.files, secondReceipt, thirdReceipt]
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
