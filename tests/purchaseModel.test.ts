import { expect, test } from 'vitest';
import type { Doc } from '../convex/_generated/dataModel';
import { applyDraftPatch, renderBusinessPurpose } from '../convex/purchaseModel';

const request = {
	_id: 'purchase_1',
	_creationTime: 1,
	owner: 'owner',
	status: 'draft',
	typeOfPurchase: 'personal_reimbursement',
	organizationSourceId: null,
	purchaserSource: { kind: 'self' },
	studentOrganization: {
		name: 'Album Listening Club',
		indexNumber: 'OS353i',
		fundLetter: 'I',
		budgetLines: ['Event Expenses'],
		businessPurposeTemplate:
			'{org} reimburses {purchaser} for {item} from {vendor} for {amount} at {eventName} on {eventDate} with {attendance} students. Recipient: {recipient} ({recipientUo95}) for {recipientReason}.'
	},
	requester: {
		id: 'user_1',
		name: 'Oliver Boorstein',
		email: 'obo@uoregon.edu',
		phone: '9073104429',
		uo95: '952043159',
		permanentAddress: '11337 Our Rd',
		idCardFrontFileId: 'file_front',
		idCardBackFileId: 'file_back'
	},
	purchaser: {
		id: 'user_1',
		name: 'Oliver Boorstein',
		uo95: '952043159',
		permanentAddress: '11337 Our Rd',
		idCardFrontFileId: 'file_front',
		idCardBackFileId: 'file_back'
	},
	eventName: 'Listening party',
	eventDate: '2026-05-22',
	eventTime: '6:30 PM',
	eventLocation: 'EMU',
	eventEstimatedAttendance: 50,
	vendor: 'Amazon',
	itemDescription: 'record',
	totalAmount: 22.98,
	budgetLineItem: 'Event Expenses',
	reimbursementReason: 'Other processes are too slow.',
	businessPurposeText: '',
	businessPurposeTouched: false,
	receiptFileIds: ['file_receipt'],
	secondApprovalFileId: 'file_approval',
	publicityFileId: 'file_publicity',
	recipients: [{ name: 'Aidan', uo95: '951951840', reason: 'winning trivia', value: 22.98 }],
	createdAt: 1,
	updatedAt: 1,
	lastFilledAt: null
} as Doc<'purchaseRequests'>;

test('coerces cleared numeric draft fields to zero', () => {
	expect(
		applyDraftPatch(request, { eventEstimatedAttendance: null, totalAmount: null })
	).toMatchObject({
		eventEstimatedAttendance: 0,
		totalAmount: 0
	});
});

test('records Type of Purchase draft changes', () => {
	expect(applyDraftPatch(request, { typeOfPurchase: 'personal_reimbursement' })).toMatchObject({
		typeOfPurchase: 'personal_reimbursement'
	});
});

test('uses the fixed Personal Reimbursement reason for draft patches', () => {
	expect(
		applyDraftPatch(request, {
			typeOfPurchase: 'personal_reimbursement',
			reimbursementReason: 'Custom reason'
		})
	).toMatchObject({
		reimbursementReason: 'Other processes are too slow.'
	});
});

test('renders business purpose from current recorded facts', () => {
	expect(renderBusinessPurpose(request)).toBe(
		'Album Listening Club reimburses Oliver Boorstein for record from Amazon for $22.98 at Listening party on 2026-05-22 with 50 students. Recipient: Aidan (951951840) for winning trivia.'
	);
});

test('renders optional recipient tokens without unresolved placeholders when absent', () => {
	expect(renderBusinessPurpose({ ...request, recipients: [] })).toBe(
		'Album Listening Club reimburses Oliver Boorstein for record from Amazon for $22.98 at Listening party on 2026-05-22 with 50 students. Recipient: N/A (N/A) for N/A.'
	);
});
