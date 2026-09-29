import { expect, test } from 'vitest';
import { requestSteps, type StepContext } from '../apps/web/src/lib/request/steps';
import { plainNextStep } from '../convex/authed/board';
import type { Id } from '../convex/_generated/dataModel';
import { sentBackStep, type RequestCheck } from '../convex/requestView';

const file = (id: string) => id as Id<'files'>;

type Sections = { section: string; reasons: string[] }[];

function draft(overrides: Record<string, unknown> = {}) {
	return {
		documentationCategories: [],
		purchaserSource: { kind: 'self' as const },
		purchaser: {
			id: 'user' as Id<'users'>,
			name: 'Jordan Lee',
			uo95: '951000000',
			permanentAddress: '1585 E 13th Ave',
			idCardFrontFileId: file('front'),
			idCardBackFileId: file('back')
		},
		activity: {
			eventId: null,
			name: 'Weekly listening event',
			dates: ['2026-10-06'],
			time: '18:30',
			location: 'McKenzie 240A',
			attendance: 50,
			openToAllStudents: true
		},
		vendor: 'Market of Choice',
		itemDescription: 'chips and salsa',
		totalAmount: 36.18,
		budgetLineItem: 'Event Expenses',
		receiptFileIds: [file('receipt')],
		secondApprovalFileId: file('approval'),
		publicityFileId: file('flyer'),
		cateringWaiverFileId: null,
		printingInvoiceFileId: null,
		brandApprovalFileId: null,
		buildingManagerApprovalFileId: null,
		computerPriceQuoteFileId: null,
		officeLocation: '',
		recipients: [],
		...overrides
	} as Parameters<typeof requestSteps>[1];
}

function view({
	sections = [],
	checks = [],
	fundLetter = 'I',
	packaged = null
}: {
	sections?: Sections;
	checks?: RequestCheck[];
	fundLetter?: string;
	packaged?: boolean | null;
} = {}) {
	return {
		readiness: { ready: sections.length === 0, sections },
		checks,
		documents: [],
		purchase: {
			studentOrganization: { fundLetter },
			foodIndividuallyPackaged: packaged,
			receiptDate: '2026-09-29'
		}
	} as unknown as Parameters<typeof requestSteps>[0];
}

const confirmed: StepContext = { reviewCount: 0, sourceOf: () => 'user' };

const packagingCheck: RequestCheck = {
	id: 'food-packaging',
	severity: 'blocking',
	title: 'Were all the snacks individually packaged?',
	detail: '',
	fileId: null,
	slot: null,
	action: 'answer'
};

test('a food, ASUO, self-paid request lists its steps in reviewer order', () => {
	const steps = requestSteps(
		view({
			sections: [{ section: 'Document checks', reasons: [packagingCheck.title] }],
			checks: [packagingCheck]
		}),
		draft({ documentationCategories: ['food'] }),
		confirmed
	);
	expect(steps.map((step) => step.id)).toEqual([
		'receipt',
		'event',
		'purchaser',
		'packaging',
		'publicity',
		'secondApproval',
		'review'
	]);
	expect(steps.find((step) => step.state === 'current')).toMatchObject({
		id: 'packaging',
		title: 'Were all the snacks individually packaged?'
	});
});

test('gifts add a Recipients step and someone else paying drops Second Approval', () => {
	const steps = requestSteps(
		view({ fundLetter: 'A' }),
		draft({
			documentationCategories: ['gifts_prizes'],
			purchaserSource: { kind: 'purchaser', purchaserId: 'sam' },
			recipients: [{ name: 'Avery Chen', uo95: '951000002', reason: 'Trivia', value: 20 }]
		}),
		confirmed
	);
	const ids = steps.map((step) => step.id);
	expect(ids).toContain('recipients');
	expect(ids).not.toContain('secondApproval');
	expect(ids).not.toContain('publicity');
	expect(steps.find((step) => step.id === 'recipients')?.summary).toBe('Avery Chen');
});

test('the ASUO fund letter always needs Publicity Proof', () => {
	const steps = requestSteps(
		view({ sections: [{ section: 'Files', reasons: ['Publicity proof missing.'] }] }),
		draft({ publicityFileId: null }),
		confirmed
	);
	expect(steps.find((step) => step.state === 'current')).toMatchObject({
		id: 'publicity',
		title: 'Add proof the event was advertised'
	});
});

test('a missing ID side adds the UO ID step right after who paid', () => {
	const steps = requestSteps(
		view({
			sections: [{ section: 'Purchaser', reasons: ['Your UO ID (front and back) missing.'] }]
		}),
		draft({ purchaser: { ...draft().purchaser, idCardBackFileId: null } }),
		confirmed
	);
	expect(steps.slice(2, 4).map((step) => step.id)).toEqual(['purchaser', 'idCard']);
	expect(steps[3]).toMatchObject({ state: 'current', title: 'Add your UO ID (front and back)' });
});

test('someone else’s missing ID asks for their UO ID', () => {
	const steps = requestSteps(
		view({
			sections: [{ section: 'Purchaser', reasons: ['Purchaser UO ID (front and back) missing.'] }]
		}),
		draft({
			purchaserSource: { kind: 'purchaser', purchaserId: 'sam' },
			purchaser: { ...draft().purchaser, name: 'Sam Rivera', idCardFrontFileId: '' }
		}),
		confirmed
	);
	expect(steps.find((step) => step.id === 'idCard')?.title).toBe(
		'Add their UO ID (front and back)'
	);
});

test('a defaulted event needs one tap before the steps after it', () => {
	const steps = requestSteps(view(), draft(), {
		reviewCount: 0,
		sourceOf: (field) => (field === 'activity' ? 'previous' : 'user')
	});
	expect(steps.find((step) => step.id === 'event')).toMatchObject({
		state: 'current',
		title: 'Check the event'
	});
	expect(steps.find((step) => step.id === 'review')?.state).toBe('todo');
});

test('when every step is done, the Business Purpose review is current', () => {
	const steps = requestSteps(view(), draft(), confirmed);
	expect(steps.filter((step) => step.state !== 'done').map((step) => step.id)).toEqual(['review']);
	expect(steps.at(-1)).toMatchObject({ state: 'current', title: 'Business Purpose' });
	expect(steps[0].summary).toBe(
		'$36.18 at Market of Choice on Tue 09/29, charged to Event Expenses'
	);
});

test('an answered packaging question stays as a collapsed step', () => {
	const steps = requestSteps(
		view({ packaged: true }),
		draft({ documentationCategories: ['food'] }),
		confirmed
	);
	expect(steps.find((step) => step.id === 'packaging')).toMatchObject({
		state: 'done',
		title: 'Snacks',
		summary: 'All sealed. No waiver needed'
	});
});

test.each([
	[{ section: 'Purchase details', reasons: ['Vendor missing.'] }],
	[{ section: 'Purchase details', reasons: ['Total amount must be greater than zero.'] }],
	[{ section: 'Purchase details', reasons: ['Item description missing.'] }],
	[{ section: 'Purchase details', reasons: ['Budget line item missing.'] }],
	[{ section: 'Files', reasons: ['Receipt document missing.'] }],
	[{ section: 'Purchase details', reasons: ['Office location missing.'] }],
	[{ section: 'Files', reasons: ['Printing invoice missing.'] }],
	[{ section: 'Purchaser', reasons: ['Purchaser address missing.'] }],
	[{ section: 'Purchaser', reasons: ['Your UO ID (front and back) missing.'] }],
	[{ section: 'Files', reasons: ['Second approval missing.'] }],
	[{ section: 'Requester', reasons: ['Requester phone missing.'] }]
])('the board’s next step matches the current step title: %o', (section) => {
	const steps = requestSteps(
		view({ sections: [section], fundLetter: 'A' }),
		draft({
			documentationCategories: ['office_supplies_goods', 'printing_services'],
			officeLocation: 'EMU 101',
			secondApprovalFileId: null
		}),
		confirmed
	);
	expect(steps.find((step) => step.state === 'current')?.title).toBe(
		plainNextStep({ sections: [section] }, [])
	);
});

test('a sent-back request with nothing missing asks to fix what Engage said', () => {
	const sentBack = view();
	Object.assign(sentBack.purchase, { reviewerNote: '' });
	const steps = requestSteps(sentBack, draft(), confirmed);
	expect(steps.find((step) => step.state === 'current')).toMatchObject({
		id: 'review',
		title: sentBackStep
	});
});

test('publicity missing matches the board with ASUO funds', () => {
	const section = { section: 'Files', reasons: ['Publicity proof missing.'] };
	const steps = requestSteps(
		view({ sections: [section] }),
		draft({ publicityFileId: null }),
		confirmed
	);
	expect(steps.find((step) => step.state === 'current')?.title).toBe(
		plainNextStep({ sections: [section] }, [])
	);
});
