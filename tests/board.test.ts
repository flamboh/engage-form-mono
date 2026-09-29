import { expect, test, vi } from 'vitest';
import type { Doc } from '../convex/_generated/dataModel';
import { organizationBoard, plainNextStep } from '../convex/authed/board';
import { readinessWithChecks } from '../convex/purchaseModel';
import type { DocumentFacts } from '../convex/extraction/facts';

vi.stubEnv('FILES_BASE_URL', 'https://files.example');
vi.stubEnv('FILES_SIGNING_SECRET', 'test-secret');

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
		{ organizationId: 'org_1' } as never
	);
	expect(board.readyToFill).toEqual([]);
	expect(board.needsInfo).toMatchObject([{ id: readyRequest._id, nextStep: view.checks[0].title }]);
});

test('a matching publicity date keeps the request ready to fill', async () => {
	const board = await organizationBoard._handler(
		boardCtx([readyRequest], [publicityRow(['--05-19'])]) as never,
		{ organizationId: 'org_1' } as never
	);
	expect(board.needsInfo).toEqual([]);
	expect(board.readyToFill).toMatchObject([{ id: readyRequest._id, nextStep: null }]);
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

function boardCtx(requests: Doc<'purchaseRequests'>[], extractions: Doc<'extractions'>[]) {
	return {
		auth: { getUserIdentity: async () => ({ tokenIdentifier: 'owner' }) },
		db: {
			get: async (id: string) => {
				if (id === 'org_1') return { _id: id, owner: 'owner', name: 'Album Listening Club' };
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
	lastFilledAt: null
} as unknown as Doc<'purchaseRequests'>;
