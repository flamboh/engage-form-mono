import { expect, test } from 'vitest';
import {
	generateBusinessPurpose,
	recipientIdText,
	recipientValueText,
	samplePurchaseRequest,
	validatePurchaseReadiness
} from './index.ts';

test('sample purchase request is ready', () => {
	expect(validatePurchaseReadiness(samplePurchaseRequest)).toEqual([]);
});

test('final common facts do not require event details', () => {
	expect(
		validatePurchaseReadiness({
			...samplePurchaseRequest,
			eventDetails: {
				name: '',
				date: '',
				time: '',
				location: '',
				estimatedAttendance: 0,
				publicityProofFileId: samplePurchaseRequest.eventDetails.publicityProofFileId
			},
			businessPurposeText: 'Album Listening Club wishes to reimburse Oliver Boorstein.'
		})
	).toEqual([]);
});

test('accepts one combined ID Card Document', () => {
	expect(
		validatePurchaseReadiness({
			...samplePurchaseRequest,
			purchaser: {
				...samplePurchaseRequest.purchaser,
				idCardFrontFileId: 'file_id_card',
				idCardBackFileId: null as never
			}
		})
	).toEqual([]);
});

test('requires one to three Receipts', () => {
	expect(
		validatePurchaseReadiness({ ...samplePurchaseRequest, receiptFileIds: [] })
	).toContainEqual({
		field: 'receiptFileIds',
		message: 'Receipt document missing.'
	});

	expect(
		validatePurchaseReadiness({
			...samplePurchaseRequest,
			receiptFileIds: ['file_receipt_1', 'file_receipt_2', 'file_receipt_3']
		})
	).toEqual([]);

	expect(
		validatePurchaseReadiness({
			...samplePurchaseRequest,
			receiptFileIds: ['file_receipt_1', 'file_receipt_2', 'file_receipt_3', 'file_receipt_4']
		})
	).toContainEqual({
		field: 'receiptFileIds',
		message: 'Receipt documents are limited to three.'
	});
});

test('blocks unsupported types of purchase', () => {
	expect(
		validatePurchaseReadiness({
			...samplePurchaseRequest,
			typeOfPurchase: 'internal_po'
		})
	).toContainEqual({
		field: 'typeOfPurchase',
		message: 'Type of Purchase is not supported yet.'
	});
});

test('does not require a user-entered reimbursement reason', () => {
	expect(
		validatePurchaseReadiness({
			...samplePurchaseRequest,
			reimbursementReason: ''
		})
	).not.toContainEqual({
		field: 'reimbursementReason',
		message: 'Reimbursement reason missing.'
	});
});

test('generates business purpose for the observed flow', () => {
	expect(generateBusinessPurpose(samplePurchaseRequest)).toContain(
		'Album Listening Club wishes to reimburse Oliver Boorstein'
	);
	expect(generateBusinessPurpose(samplePurchaseRequest)).toContain("Aidan O'Donnell (951951840)");
});

test('blocks unresolved business purpose tokens', () => {
	expect(
		validatePurchaseReadiness({
			...samplePurchaseRequest,
			businessPurposeText: 'Reimburse {purchaser} for {item}.'
		})
	).toContainEqual({
		field: 'businessPurposeText',
		message: 'Business purpose has unresolved variables.'
	});
});

test('does not require recipients', () => {
	expect(
		validatePurchaseReadiness({
			...samplePurchaseRequest,
			recipients: [],
			businessPurposeText: 'Album Listening Club wishes to reimburse Oliver Boorstein.'
		})
	).not.toContainEqual({ field: 'recipients', message: 'Recipient missing.' });
});

test('Merchandise/Apparel and Gifts/Prizes require recipient name, UO 95, and value', () => {
	for (const category of ['merchandise_apparel', 'gifts_prizes'] as const) {
		expect(
			validatePurchaseReadiness({
				...samplePurchaseRequest,
				documentationCategories: [category],
				recipients: [],
				businessPurposeText: 'Album Listening Club wishes to reimburse Oliver Boorstein.'
			})
		).toContainEqual({ field: 'recipients', message: 'Recipient missing.' });

		expect(
			validatePurchaseReadiness({
				...samplePurchaseRequest,
				documentationCategories: [category],
				recipients: [
					{
						name: '',
						uo95: '',
						reason: '',
						itemDescription: 'Sticker',
						value: 0
					}
				]
			})
		).toEqual(
			expect.arrayContaining([
				{ field: 'recipient.name', message: 'Recipient name missing.' },
				{ field: 'recipient.uo95', message: 'Recipient UO 95 missing.' },
				{ field: 'recipient.value', message: 'Recipient value missing.' }
			])
		);
	}
});

test('recipient reason, dollar limits, and total matching do not block Ready', () => {
	expect(
		validatePurchaseReadiness({
			...samplePurchaseRequest,
			documentationCategories: ['gifts_prizes'],
			totalAmount: 10,
			recipients: [
				{
					name: 'Prize recipient',
					uo95: '950000001',
					reason: '',
					itemDescription: 'Prize',
					value: 75
				}
			]
		})
	).not.toEqual(
		expect.arrayContaining([
			{ field: 'recipient.reason', message: 'Recipient reason missing.' },
			{ field: 'recipient.value', message: 'Gift value must be under $50.' },
			{ field: 'recipients', message: 'Recipient values must equal total amount.' }
		])
	);
});

test('does not enforce recipient details or value limits', () => {
	expect(
		validatePurchaseReadiness({
			...samplePurchaseRequest,
			recipients: [
				{ ...samplePurchaseRequest.recipients[0], name: '', uo95: '', reason: '', value: 50 }
			]
		})
	).not.toEqual(
		expect.arrayContaining([
			{ field: 'recipient.name', message: 'Recipient name missing.' },
			{ field: 'recipient.uo95', message: 'Recipient UO 95 missing.' },
			{ field: 'recipient.reason', message: 'Recipient reason missing.' },
			{ field: 'recipient.value', message: 'Gift value must be under $50.' }
		])
	);
});

test('reports entered recipients regardless of value', () => {
	const purchase = {
		...samplePurchaseRequest,
		totalAmount: 8,
		recipients: [
			{
				name: 'Sticker recipient',
				uo95: '950000001',
				reason: '',
				itemDescription: 'Sticker',
				value: 8
			}
		]
	};

	expect(recipientValueText(purchase)).toBe('Sticker recipient, $8.00');
	expect(recipientIdText(purchase)).toBe('Sticker recipient, 950000001');
});

test('requires second approval only for requester purchases', () => {
	expect(
		validatePurchaseReadiness({ ...samplePurchaseRequest, secondApprovalFileId: null })
	).toContainEqual({
		field: 'secondApprovalFileId',
		message: 'Second approval missing.'
	});

	expect(
		validatePurchaseReadiness({
			...samplePurchaseRequest,
			requesterIsPurchaser: false,
			purchaser: { ...samplePurchaseRequest.purchaser, id: 'person_someone_else' },
			secondApprovalFileId: null
		})
	).not.toContainEqual({
		field: 'secondApprovalFileId',
		message: 'Second approval missing.'
	});
});
