import { expect, test } from 'vitest';
import type { Doc, Id } from '../convex/_generated/dataModel';
import {
	detachDocument,
	documentReadFailed,
	isCurrentAttempt,
	placeDocument,
	receiptFieldsPatch,
	receiptRemovalChecks,
	requestDocuments,
	requestReviews,
	resolveReviewPatch,
	slotForKind
} from '../convex/extraction/apply';
import {
	changedSnapshotPatch,
	previousRequestDefaults,
	withSuggestedEvent,
	userFieldSources
} from '../convex/purchaseModel';

const receiptA = 'file_a' as Id<'files'>;
const receiptB = 'file_b' as Id<'files'>;

const draft = {
	_id: 'purchase_1',
	_creationTime: 1,
	owner: 'owner',
	status: 'draft',
	typeOfPurchase: 'personal_reimbursement',
	documentationCategories: [],
	organizationSourceId: 'org_1',
	purchaserSource: { kind: 'self' },
	studentOrganization: {
		name: 'Album Listening Club',
		indexNumber: 'OS1',
		fundLetter: 'I',
		budgetLines: ['Event Expenses', 'Food']
	},
	requester: {
		id: 'user_1',
		name: 'Test Student',
		email: 't@uoregon.edu',
		phone: '5555555555',
		uo95: '950000000',
		permanentAddress: '1 Test Rd',
		idCardFrontFileId: 'file_front',
		idCardBackFileId: null
	},
	purchaser: {
		id: 'user_1',
		name: 'Test Student',
		uo95: '950000000',
		permanentAddress: '1 Test Rd',
		idCardFrontFileId: 'file_front',
		idCardBackFileId: null
	},
	activity: {
		eventId: null,
		name: '',
		dates: [],
		time: '',
		location: '',
		attendance: null,
		openToAllStudents: true
	},
	vendor: '',
	itemDescription: '',
	totalAmount: 0,
	budgetLineItem: 'Event Expenses',
	reimbursementReason: 'Other processes are too slow.',
	businessPurposeOverride: null,
	receiptFileIds: [receiptA, receiptB],
	secondApprovalFileId: null,
	publicityFileId: null,
	cateringWaiverFileId: null,
	printingInvoiceFileId: null,
	brandApprovalFileId: null,
	officeLocation: '',
	buildingManagerApprovalFileId: null,
	computerPriceQuoteFileId: null,
	recipients: [],
	createdAt: 1,
	updatedAt: 1,
	lastFilledAt: null,
	approvedAt: null,
	reviewerNote: null
} as unknown as Doc<'purchaseRequests'>;

function extraction(
	fileId: Id<'files'>,
	fields: Partial<
		Pick<Doc<'extractions'>, 'vendor' | 'totalAmount' | 'receiptDate' | 'items' | 'status'>
	>
) {
	return {
		fileId,
		status: 'done' as const,
		vendor: null,
		totalAmount: null,
		receiptDate: null,
		items: [],
		...fields
	};
}

const sure = (value: string) => ({ value, confident: true, alternatives: [] });

const bigbox = extraction(receiptA, {
	vendor: sure('Bigbox Wholesale'),
	totalAmount: sure('28.48'),
	receiptDate: sure('2025-10-14'),
	items: ['5550001 KS TRAIL MIX 18.49', 'KS COCOA BITES']
});
const corner = extraction(receiptB, {
	vendor: sure('Corner Records'),
	totalAmount: { value: '19.00', confident: false, alternatives: ['9.00', '21.00'] },
	receiptDate: sure('2025-10-12'),
	items: ['1 NEW LP']
});

test('multiple receipts fill summed totals, joined vendors, items, and the earliest date', () => {
	expect(receiptFieldsPatch(draft, [bigbox, corner])).toEqual({
		vendor: 'Bigbox Wholesale, Corner Records',
		itemDescription: 'KS Trail Mix, KS Cocoa Bites, New LP',
		totalAmount: 47.48,
		receiptDate: '2025-10-12',
		fieldSources: {
			vendor: 'receipt',
			itemDescription: 'receipt',
			totalAmount: 'receipt',
			receiptDate: 'receipt'
		}
	});
});

test('receipt extraction never overwrites user-set fields', () => {
	const touched = {
		...draft,
		vendor: 'Typed Vendor',
		fieldSources: { vendor: 'user' }
	} as Doc<'purchaseRequests'>;
	const patch = receiptFieldsPatch(touched, [bigbox]);
	expect(patch).not.toHaveProperty('vendor');
	expect(patch).not.toHaveProperty('activity');
	expect(patch.totalAmount).toBe(28.48);
	expect(patch.fieldSources).toMatchObject({ vendor: 'user' });
});

test('pending extractions and detached receipts do not contribute', () => {
	const pending = extraction(receiptB, { status: 'running', totalAmount: sure('99.00') });
	expect(receiptFieldsPatch(draft, [bigbox, pending]).totalAmount).toBe(28.48);
	const detached = extraction('file_c' as Id<'files'>, { totalAmount: sure('99.00') });
	expect(receiptFieldsPatch(draft, [bigbox, detached]).totalAmount).toBe(28.48);
});

test('removing a receipt recomputes receipt-sourced fields and clears when none remain', () => {
	const filled = {
		...draft,
		...receiptFieldsPatch(draft, [bigbox, corner])
	} as Doc<'purchaseRequests'>;
	const withoutCorner = { ...filled, ...detachDocument(filled, receiptB) };
	expect(receiptFieldsPatch(withoutCorner, [bigbox, corner])).toMatchObject({
		vendor: 'Bigbox Wholesale',
		totalAmount: 28.48,
		itemDescription: 'KS Trail Mix, KS Cocoa Bites',
		receiptDate: '2025-10-14'
	});
	const empty = { ...filled, receiptFileIds: [] } as Doc<'purchaseRequests'>;
	const cleared = receiptFieldsPatch(empty, [bigbox, corner]);
	expect(cleared).toMatchObject({
		vendor: '',
		itemDescription: '',
		totalAmount: 0
	});
	expect(cleared).toHaveProperty('receiptDate', undefined);
	expect(cleared.fieldSources).toEqual({});
});

test('unsure receipt fields become reviews with combined alternatives', () => {
	const filled = {
		...draft,
		...receiptFieldsPatch(draft, [bigbox, corner])
	} as Doc<'purchaseRequests'>;
	expect(requestReviews(filled, [bigbox, corner])).toEqual([
		{ field: 'totalAmount', value: '47.48', alternatives: ['37.48', '49.48'] }
	]);
	const resolved = { ...filled, ...resolveReviewPatch(filled, 'totalAmount', '$49.48') };
	expect(resolved.totalAmount).toBe(49.48);
	expect(resolved.fieldSources?.totalAmount).toBe('user');
	expect(requestReviews(resolved, [bigbox, corner])).toEqual([]);
});

test('a missing value with alternatives still asks, and an empty guess never shows', () => {
	const handwritten = extraction(receiptA, {
		vendor: sure('Corner Records'),
		totalAmount: { value: '', confident: false, alternatives: ['19.00'] }
	});
	const single = { ...draft, receiptFileIds: [receiptA] } as Doc<'purchaseRequests'>;
	const filled = { ...single, ...receiptFieldsPatch(single, [handwritten]) };
	expect(filled.totalAmount).toBe(0);
	expect(requestReviews(filled, [handwritten])).toEqual([
		{ field: 'totalAmount', value: '', alternatives: ['19.00'] }
	]);
	const blank = extraction(receiptA, {
		totalAmount: { value: '', confident: false, alternatives: [] }
	});
	expect(requestReviews(single, [blank])).toEqual([]);
});

test('resolving the receipt date leaves the event dates alone', () => {
	const filled = {
		...draft,
		receiptDate: '2025-10-14',
		fieldSources: { receiptDate: 'receipt' }
	} as Doc<'purchaseRequests'>;
	expect(resolveReviewPatch(filled, 'receiptDate', '2025-10-15')).toEqual({
		receiptDate: '2025-10-15',
		fieldSources: { receiptDate: 'user' }
	});
	expect(() => resolveReviewPatch(filled, 'totalAmount', 'abc')).toThrow();
});

test('documents move between slots without duplicates', () => {
	const flyer = 'file_flyer' as Id<'files'>;
	const withFlyer = {
		...draft,
		...placeDocument(draft, flyer, 'receipt')
	} as Doc<'purchaseRequests'>;
	expect(withFlyer.receiptFileIds).toEqual([receiptA, receiptB, flyer]);
	const moved = { ...withFlyer, ...placeDocument(withFlyer, flyer, 'publicity') };
	expect(moved.receiptFileIds).toEqual([receiptA, receiptB]);
	expect(moved.publicityFileId).toBe(flyer);
	expect(requestDocuments(moved as Doc<'purchaseRequests'>)).toEqual([
		{ fileId: receiptA, slot: 'receipt' },
		{ fileId: receiptB, slot: 'receipt' },
		{ fileId: flyer, slot: 'publicity' }
	]);
	expect(() => placeDocument(draft, flyer, 'recipient_list')).toThrow();
	expect(slotForKind('other', true)).toBe('receipt');
	expect(slotForKind('other', false)).toBeNull();
	expect(slotForKind('second_approval', false)).toBe('second_approval');
});

test('new drafts copy defaults from the previous request in the organization', () => {
	const purchaser = {
		_id: 'purchaser_1',
		organizationId: 'org_1',
		archived: false,
		name: 'Pat Payer',
		uo95: '951111111',
		permanentAddress: '2 Test Rd',
		idCardFrontFileId: 'file_pat',
		idCardBackFileId: null
	} as unknown as Doc<'purchasers'>;
	const previous = {
		...draft,
		purchaserSource: { kind: 'purchaser', purchaserId: purchaser._id },
		budgetLineItem: 'Food',
		documentationCategories: ['food'],
		activity: {
			eventId: null,
			name: 'Weekly event',
			dates: ['2025-10-14'],
			time: '18:00',
			location: 'Room 1',
			attendance: 30,
			openToAllStudents: true
		}
	} as Doc<'purchaseRequests'>;
	const organization = {
		_id: 'org_1',
		budgetLines: [
			{ name: 'Event Expenses', allocations: [] },
			{ name: 'Food', allocations: [] }
		]
	} as never;
	expect(previousRequestDefaults(previous, organization, purchaser)).toEqual({
		purchaserSource: previous.purchaserSource,
		purchaser: {
			id: 'purchaser_1',
			name: 'Pat Payer',
			uo95: '951111111',
			permanentAddress: '2 Test Rd',
			idCardFrontFileId: 'file_pat',
			idCardBackFileId: null
		},
		activity: { ...previous.activity, dates: [] },
		budgetLineItem: 'Food',
		documentationCategories: ['food'],
		reimbursementReason: 'Other processes are too slow.',
		fieldSources: {
			purchaserSource: 'previous',
			activity: 'previous',
			budgetLineItem: 'previous',
			documentationCategories: 'previous',
			reimbursementReason: 'previous'
		}
	});
	const archived = { ...purchaser, archived: true } as Doc<'purchasers'>;
	const withoutPurchaser = previousRequestDefaults(
		{ ...previous, budgetLineItem: 'Gone Line' } as Doc<'purchaseRequests'>,
		organization,
		archived
	);
	expect(withoutPurchaser).not.toHaveProperty('purchaserSource');
	expect(withoutPurchaser).not.toHaveProperty('budgetLineItem');
	expect(previousRequestDefaults(null, organization, null)).toEqual({});
});

test('snapshot edits mark changed fields as user-set', () => {
	const filled = {
		...draft,
		vendor: 'Bigbox Wholesale',
		totalAmount: 28.48,
		fieldSources: { vendor: 'receipt', totalAmount: 'receipt', budgetLineItem: 'suggested' }
	} as Doc<'purchaseRequests'>;
	expect(
		userFieldSources(filled, { vendor: 'Bigbox', totalAmount: 28.48, budgetLineItem: 'Food' })
	).toEqual({ vendor: 'user', totalAmount: 'receipt', budgetLineItem: 'user' });
	expect(userFieldSources(filled, { vendor: 'Bigbox Wholesale' })).toBe(filled.fieldSources);
});

test('snapshot saves with changedFields only apply and mark the edited fields', () => {
	const filled = {
		...draft,
		vendor: 'Bigbox Wholesale',
		totalAmount: 28.48,
		budgetLineItem: 'Event Expenses',
		fieldSources: { vendor: 'receipt', totalAmount: 'receipt' }
	} as Doc<'purchaseRequests'>;
	const staleSnapshot = {
		typeOfPurchase: 'personal_reimbursement' as const,
		reimbursementReason: 'Other processes are too slow.',
		vendor: '',
		totalAmount: 0,
		budgetLineItem: 'Food',
		businessPurposeOverride: 'For the vendor',
		purchaserSource: { kind: 'self' as const },
		purchaser: filled.purchaser,
		updatedAt: 5
	};
	const patch = changedSnapshotPatch(staleSnapshot, ['budgetLineItem']);
	expect(patch).toEqual({ budgetLineItem: 'Food', updatedAt: 5 });
	expect(userFieldSources(filled, patch)).toEqual({
		vendor: 'receipt',
		totalAmount: 'receipt',
		budgetLineItem: 'user'
	});
	expect(Object.keys(changedSnapshotPatch(staleSnapshot, ['businessPurposeOverride']))).toEqual([
		'businessPurposeOverride',
		'updatedAt'
	]);
	expect(Object.keys(changedSnapshotPatch(staleSnapshot, ['typeOfPurchase']))).toEqual([
		'typeOfPurchase',
		'reimbursementReason',
		'updatedAt'
	]);
	expect(Object.keys(changedSnapshotPatch(staleSnapshot, ['purchaserSource']))).toEqual([
		'purchaserSource',
		'purchaser',
		'updatedAt'
	]);
	expect(changedSnapshotPatch(staleSnapshot, [])).toEqual({ updatedAt: 5 });
});

test('only the current extraction attempt may finish or fail', () => {
	expect(isCurrentAttempt({ attempt: 2 }, 2)).toBe(true);
	expect(isCurrentAttempt({ attempt: 2 }, 1)).toBe(false);
	expect(isCurrentAttempt({ attempt: 1 }, undefined)).toBe(false);
	expect(isCurrentAttempt({}, undefined)).toBe(true);
	expect(isCurrentAttempt({}, 1)).toBe(false);
});

test('documents that failed or read nothing are flagged for the user', () => {
	expect(documentReadFailed('receipt', null)).toBe(false);
	expect(documentReadFailed('receipt', extraction(receiptA, { status: 'failed' }))).toBe(true);
	expect(documentReadFailed('publicity', extraction(receiptA, { status: 'failed' }))).toBe(true);
	expect(documentReadFailed('receipt', extraction(receiptA, { status: 'running' }))).toBe(false);
	expect(documentReadFailed('receipt', extraction(receiptA, {}))).toBe(true);
	expect(documentReadFailed('publicity', extraction(receiptA, {}))).toBe(false);
	expect(documentReadFailed('receipt', bigbox)).toBe(false);
});

test('failed receipts are left out of totals while successful ones still sum', () => {
	const failed = extraction(receiptB, { status: 'failed' });
	expect(receiptFieldsPatch(draft, [bigbox, failed]).totalAmount).toBe(28.48);
});

test('removing a receipt asks to check user-typed store and items', () => {
	const typed = {
		...draft,
		receiptFileIds: [receiptA],
		vendor: 'Bigbox and Corner Records',
		itemDescription: 'New LP for the listening party',
		fieldSources: { vendor: 'user', itemDescription: 'user' }
	} as Doc<'purchaseRequests'>;
	const checks = receiptRemovalChecks(typed);
	expect(checks).toEqual([
		{ field: 'vendor', value: 'Bigbox and Corner Records' },
		{ field: 'itemDescription', value: 'New LP for the listening party' }
	]);
	const removed = { ...typed, receiptChecks: checks } as Doc<'purchaseRequests'>;
	expect(requestReviews(removed, [bigbox])).toEqual([
		{
			field: 'vendor',
			value: 'Bigbox and Corner Records',
			alternatives: ['Bigbox Wholesale'],
			receiptRemoved: true
		},
		{
			field: 'itemDescription',
			value: 'New LP for the listening party',
			alternatives: ['KS Trail Mix, KS Cocoa Bites'],
			receiptRemoved: true
		}
	]);
});

test('removing a receipt flags any user-typed store, even without shared words', () => {
	const typed = {
		...draft,
		receiptFileIds: [receiptA],
		vendor: 'Test Edited Store',
		itemDescription: 'Snacks',
		fieldSources: { vendor: 'user', itemDescription: 'receipt' }
	} as Doc<'purchaseRequests'>;
	const checks = receiptRemovalChecks(typed);
	expect(checks).toEqual([{ field: 'vendor', value: 'Test Edited Store' }]);
	expect(
		requestReviews({ ...typed, receiptChecks: checks } as Doc<'purchaseRequests'>, [bigbox])
	).toEqual([
		{
			field: 'vendor',
			value: 'Test Edited Store',
			alternatives: ['Bigbox Wholesale'],
			receiptRemoved: true
		}
	]);
});

test('removal checks skip receipt-filled and already edited fields', () => {
	const filled = {
		...draft,
		vendor: 'Bigbox Wholesale',
		itemDescription: 'Snacks',
		fieldSources: { vendor: 'receipt', itemDescription: 'receipt' }
	} as Doc<'purchaseRequests'>;
	expect(receiptRemovalChecks(filled)).toEqual([]);
	const edited = {
		...filled,
		vendor: 'Bigbox',
		fieldSources: { vendor: 'user' },
		receiptChecks: [{ field: 'vendor', value: 'Bigbox Wholesale' }]
	} as Doc<'purchaseRequests'>;
	expect(requestReviews(edited, [])).toEqual([]);
});

test('confirming a store or items clears its removal check', () => {
	const flagged = {
		...draft,
		vendor: 'Corner Records',
		itemDescription: 'LP',
		fieldSources: { vendor: 'user', itemDescription: 'user' },
		receiptChecks: [
			{ field: 'vendor', value: 'Corner Records' },
			{ field: 'itemDescription', value: 'LP' }
		]
	} as Doc<'purchaseRequests'>;
	expect(resolveReviewPatch(flagged, 'itemDescription', ' Vinyl LP ')).toEqual({
		itemDescription: 'Vinyl LP',
		fieldSources: { vendor: 'user', itemDescription: 'user' },
		receiptChecks: [{ field: 'vendor', value: 'Corner Records' }]
	});
	expect(() => resolveReviewPatch(flagged, 'itemDescription', ' ')).toThrow('Items missing.');
});

test('new drafts suggest the most recently used saved event when there is no previous one', () => {
	const event = (id: string, name: string, lastUsedAt: number | null, creation: number) =>
		({
			_id: id,
			_creationTime: creation,
			owner: 'owner',
			organizationId: 'org_1',
			name,
			weekday: 2,
			time: '18:30',
			location: 'McKenzie 240A',
			attendance: 50,
			openToAllStudents: true,
			lastUsedAt,
			archived: false,
			updatedAt: creation
		}) as unknown as Doc<'events'>;
	const events = [
		event('event_old', 'Old night', 10, 1),
		event('event_new', 'Trivia night', 20, 2)
	];
	expect(withSuggestedEvent({}, events)).toMatchObject({
		activity: { eventId: 'event_new', name: 'Trivia night', dates: [], time: '18:30' },
		fieldSources: { activity: 'suggested' }
	});
	const previous = { activity: { name: 'Kept' } } as Partial<Doc<'purchaseRequests'>>;
	expect(withSuggestedEvent(previous, events)).toBe(previous);
	expect(withSuggestedEvent({}, [])).toEqual({});
});
