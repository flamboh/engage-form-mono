import { expect, test, vi } from 'vitest';
import type { Doc } from '../convex/_generated/dataModel';
import {
	markSentBack,
	organizationBoard,
	plainNextStep,
	sentBackStep
} from '../convex/authed/board';
import { readinessWithChecks } from '../convex/purchaseModel';
import type { DocumentFacts } from '../convex/extraction/facts';

vi.stubEnv('FILES_BASE_URL', 'https://files.example');
vi.stubEnv('FILES_SIGNING_SECRET', 'test-secret');

const today = '2026-09-29';
const blocking = { severity: 'blocking' as const, title: 'Publicity shows a different date' };
const warning = { severity: 'warning' as const, title: 'Add an itemized receipt' };
const checksSection = { section: 'Document checks', reasons: [blocking.title] };

test('a blocking check is the next step once the request has its receipt', () => {
	expect(plainNextStep({ sections: [checksSection] }, [blocking, warning])).toBe(
		'Publicity shows a different date'
	);
	expect(
		plainNextStep(
			{ sections: [{ section: 'Purchase details', reasons: ['Vendor missing.'] }, checksSection] },
			[blocking]
		)
	).toBe('Publicity shows a different date');
	expect(
		plainNextStep(
			{
				sections: [{ section: 'Files', reasons: ['Receipt document missing.'] }, checksSection]
			},
			[blocking]
		)
	).toBe('Add a receipt');
});

test('warnings alone leave no next step', () => {
	expect(plainNextStep({ sections: [] }, [warning])).toBeNull();
	expect(
		plainNextStep({ sections: [{ section: 'Purchase details', reasons: ['Vendor missing.'] }] }, [
			warning
		])
	).toBe('Add where it was bought');
});

test('the board and the request page agree on a blocking publicity date', async () => {
	const stale = publicityRow(['--05-26']);
	const view = await readinessWithChecks(boardCtx([], []) as never, readyRequest, [stale]);
	expect(view.readiness.ready).toBe(false);
	expect(view.checks[0]).toMatchObject({ id: 'publicity-date', severity: 'blocking' });

	const board = await organizationBoard._handler(
		boardCtx([readyRequest], [stale]) as never,
		{ organizationId: 'org_1', today } as never
	);
	expect(board.readyToFill).toEqual([]);
	expect(board.toFinish).toMatchObject([{ id: readyRequest._id, nextStep: view.checks[0].title }]);
});

test('a matching publicity date keeps the request ready to fill', async () => {
	const board = await organizationBoard._handler(
		boardCtx([readyRequest], [publicityRow(['--05-19'])]) as never,
		{ organizationId: 'org_1', today } as never
	);
	expect(board.toFinish).toEqual([]);
	expect(board.readyToFill).toMatchObject([
		{ id: readyRequest._id, nextStep: null, stage: 'ready' }
	]);
});

test('requests land in their groups, sorted by what is most urgent', async () => {
	const incomplete = { ...readyRequest, status: 'draft', publicityFileId: null };
	const rows = [
		{ ...readyRequest, _id: 'ready_draft', status: 'draft', updatedAt: 5 },
		{ ...readyRequest, _id: 'filled', lastFilledAt: 10, updatedAt: 4 },
		{ ...incomplete, _id: 'no_receipt_date', updatedAt: 9, receiptDate: undefined },
		{ ...incomplete, _id: 'overdue', updatedAt: 3, receiptDate: '2026-08-28' },
		{ ...incomplete, _id: 'last_week', updatedAt: 2, receiptDate: '2026-09-04' },
		{
			...incomplete,
			_id: 'tracked_late',
			receiptDate: '2026-09-20',
			activity: { ...readyRequest.activity, dates: ['2026-10-01', '2026-10-20'] }
		},
		{
			...incomplete,
			_id: 'tracked_soon',
			receiptDate: '2026-09-20',
			activity: { ...readyRequest.activity, dates: ['2026-10-06'] }
		},
		{
			...incomplete,
			_id: 'tracked_undated',
			receiptDate: '2026-09-20',
			activity: { ...readyRequest.activity, dates: [] }
		},
		{
			...readyRequest,
			_id: 'sent_back',
			status: 'draft',
			reviewerNote: '',
			updatedAt: 1,
			receiptDate: undefined
		},
		{ ...readyRequest, _id: 'approved_now', status: 'approved', receiptDate: '2026-07-01' },
		{
			...readyRequest,
			_id: 'approved_other',
			status: 'approved',
			totalAmount: 1.01,
			receiptDate: '2026-08-02'
		},
		{ ...readyRequest, _id: 'approved_last_year', status: 'approved', receiptDate: '2026-06-30' }
	] as Doc<'purchaseRequests'>[];
	const board = await organizationBoard._handler(
		boardCtx(
			rows,
			[],
			[{ name: 'Food', allocations: [{ fiscalYear: 2026, amount: 300 }] }]
		) as never,
		{ organizationId: 'org_1', today } as never
	);
	const ids = (items: { id: string }[]) => items.map((item) => item.id);
	expect(board.organization.hasAllocations).toBe(true);
	expect(ids(board.readyToFill)).toEqual(['ready_draft']);
	expect(ids(board.waitingOnEngage)).toEqual(['filled']);
	expect(ids(board.toFinish)).toEqual(['overdue', 'last_week', 'no_receipt_date', 'sent_back']);
	expect(ids(board.afterEvent)).toEqual(['tracked_soon', 'tracked_late', 'tracked_undated']);
	expect(board.toFinish.map((item) => item.daysLeft)).toEqual([-2, 5, null, null]);
	expect(board.toFinish.at(-1)).toMatchObject({ stage: 'to_finish', nextStep: sentBackStep });
	expect(board.afterEvent[1]).toMatchObject({
		stage: 'after_event',
		finishAfter: '2026-10-20',
		deadline: '2026-10-20',
		daysLeft: 21
	});
	expect(board.approvedThisYear).toEqual({ count: 2, total: 23.99 });
});

test('a request being read lands where it will go once it is read', async () => {
	const reading = { ...readyRequest, status: 'draft' } as Doc<'purchaseRequests'>;
	const pending = { ...publicityRow(['--05-19']), status: 'pending' } as Doc<'extractions'>;
	const board = await organizationBoard._handler(
		boardCtx([reading], [pending]) as never,
		{ organizationId: 'org_1', today } as never
	);
	expect(board.readyToFill).toMatchObject([{ id: reading._id, stage: 'reading', reading: true }]);
});

test('only a filled request can be sent back, and it reopens as a draft with the note', async () => {
	const patches: [string, Record<string, unknown>][] = [];
	const ctx = (request: Doc<'purchaseRequests'>) => ({
		auth: { getUserIdentity: async () => ({ tokenIdentifier: 'owner' }) },
		db: {
			get: async () => request,
			patch: async (id: string, patch: Record<string, unknown>) => void patches.push([id, patch])
		}
	});
	await expect(
		markSentBack._handler(ctx(readyRequest) as never, {
			purchaseRequestId: readyRequest._id,
			note: 'x'
		})
	).rejects.toThrow('Only requests filled on Engage can be sent back.');
	await markSentBack._handler(ctx({ ...readyRequest, lastFilledAt: 10 }) as never, {
		purchaseRequestId: readyRequest._id,
		note: '  Needs the itemized receipt.  '
	});
	expect(patches).toEqual([
		[
			readyRequest._id,
			{
				status: 'draft',
				lastFilledAt: null,
				reviewerNote: 'Needs the itemized receipt.',
				updatedAt: expect.any(Number)
			}
		]
	]);
});

function facts(overrides: Partial<DocumentFacts>): DocumentFacts {
	return {
		itemized: true,
		cardLast4: '4242',
		fulfillment: 'in_person',
		food: false,
		mentionsFood: true,
		eventDates: [],
		dates: [],
		approverEmail: null,
		text: '',
		...overrides
	};
}

function publicityRow(dates: string[]) {
	return {
		purchaseRequestId: 'purchase_1',
		fileId: 'file_publicity',
		status: 'done',
		vendor: null,
		totalAmount: null,
		facts: facts({ dates, eventDates: dates })
	} as unknown as Doc<'extractions'>;
}

function boardCtx(
	requests: Doc<'purchaseRequests'>[],
	extractions: Doc<'extractions'>[],
	budgetLines: Doc<'organizations'>['budgetLines'] = []
) {
	return {
		auth: { getUserIdentity: async () => ({ tokenIdentifier: 'owner' }) },
		db: {
			get: async (id: string) => {
				if (id === 'org_1') {
					return { _id: id, owner: 'owner', name: 'Album Listening Club', budgetLines };
				}
				if (id.startsWith('file_')) return { _id: id, owner: 'owner' };
				return null;
			},
			query: (table: string) => ({
				withIndex: (_name: string, select: (q: Filter) => Filter) => {
					const filter = new Filter();
					select(filter);
					const rows = (table === 'extractions' ? extractions : requests).filter((row) =>
						Object.entries(filter.values).every(
							([key, value]) => (row as Record<string, unknown>)[key] === value
						)
					);
					return { take: async () => rows, order: () => ({ take: async () => rows }) };
				}
			})
		}
	};
}

class Filter {
	values: Record<string, unknown> = {};
	eq(key: string, value: unknown) {
		this.values[key] = value;
		return this;
	}
}

const readyRequest = {
	_id: 'purchase_1',
	_creationTime: 1,
	owner: 'owner',
	status: 'ready',
	typeOfPurchase: 'personal_reimbursement',
	documentationCategories: ['asuo_funds'],
	organizationSourceId: 'org_1',
	purchaserSource: { kind: 'self' },
	studentOrganization: {
		name: 'Album Listening Club',
		indexNumber: 'OS353i',
		fundLetter: 'I',
		budgetLines: ['Event Expenses']
	},
	requester: {
		id: 'user_1',
		name: 'Sam Rivera',
		email: 'sam@uoregon.edu',
		phone: '5415550100',
		uo95: '951000001',
		permanentAddress: '1 Main St',
		idCardFrontFileId: 'file_front',
		idCardBackFileId: 'file_back'
	},
	purchaser: {
		id: 'user_1',
		name: 'Sam Rivera',
		uo95: '951000001',
		permanentAddress: '1 Main St',
		idCardFrontFileId: 'file_front',
		idCardBackFileId: 'file_back'
	},
	activity: {
		eventId: null,
		name: 'Weekly listening event',
		dates: ['2026-05-19'],
		time: '18:30',
		location: 'McKenzie 240A',
		attendance: 50,
		openToAllStudents: true
	},
	vendor: 'Amazon',
	itemDescription: 'record',
	totalAmount: 22.98,
	budgetLineItem: 'Event Expenses',
	reimbursementReason: 'Other processes are too slow.',
	purpose: 'prizes for trivia night',
	businessPurposeOverride: null,
	receiptFileIds: ['file_receipt'],
	secondApprovalFileId: 'file_approval',
	publicityFileId: 'file_publicity',
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
	reviewerNote: null,
	receiptDate: '2026-09-20'
} as unknown as Doc<'purchaseRequests'>;
