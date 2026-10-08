import { expect, test } from 'vitest';
import { requestMode, requestSteps, type StepContext } from '../apps/web/src/lib/request/steps';
import { plainNextStep, unconfirmedSteps } from '../convex/authed/board';
import type { Id } from '../convex/_generated/dataModel';
import { categoriesStep, sentBackStep, type RequestCheck } from '../convex/requestView';

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
		'categories',
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

test('the Recipients step names each missing recipient field once', () => {
	const steps = requestSteps(
		view({
			fundLetter: 'A',
			sections: [
				{
					section: 'Recipients',
					reasons: [
						'Recipient reason missing.',
						'Recipient UO 95 missing.',
						'Recipient reason missing.'
					]
				}
			]
		}),
		draft({
			documentationCategories: ['gifts_prizes'],
			recipients: [
				{ name: 'Avery Chen', uo95: '951000002', reason: '', value: 20 },
				{ name: 'Sam Rivera', uo95: '', reason: '', value: 20 }
			]
		}),
		confirmed
	);
	expect(steps.find((step) => step.id === 'recipients')).toMatchObject({
		state: 'current',
		title: 'Say why each recipient got it',
		blockingReasons: ['Say why each recipient got it', 'Add each recipient’s 95#']
	});
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
	expect(steps.slice(3, 5).map((step) => step.id)).toEqual(['purchaser', 'idCard']);
	expect(steps[4]).toMatchObject({ state: 'current', title: 'Add your UO ID (front and back)' });
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
	[{ section: 'Requester', reasons: ['Requester phone missing.'] }],
	[{ section: 'Recipients', reasons: ['Recipient reason missing.'] }]
])('the board’s next step matches the current step title: %o', (section) => {
	const steps = requestSteps(
		view({ sections: [section], fundLetter: 'A' }),
		draft({
			documentationCategories: ['office_supplies_goods', 'printing_services', 'gifts_prizes'],
			officeLocation: 'EMU 101',
			printingInvoiceFileId: file('invoice'),
			secondApprovalFileId: null,
			recipients: [
				{ name: 'Akio Freauff', uo95: '952190904', reason: 'Raffle prize', value: 39.95 }
			]
		}),
		confirmed
	);
	expect(steps.find((step) => step.state === 'current')?.title).toBe(
		plainNextStep({ sections: [section] }, [], [])
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
		plainNextStep({ sections: [section] }, [], [])
	);
});

const unconfirmed: StepContext = {
	reviewCount: 0,
	sourceOf: (field) => (field === 'documentationCategories' ? undefined : 'user')
};

test('unconfirmed categories are one tap right after the receipt, and the board agrees', () => {
	const section = { section: 'Files', reasons: ['Second approval missing.'] };
	const steps = requestSteps(
		view({ sections: [section] }),
		draft({ secondApprovalFileId: null }),
		unconfirmed
	);
	expect(steps.map((step) => step.id).slice(0, 2)).toEqual(['receipt', 'categories']);
	expect(steps[1]).toMatchObject({
		state: 'current',
		title: categoriesStep,
		summary: 'Nothing special'
	});
	expect(plainNextStep({ sections: [section] }, [], ['categories'])).toBe(categoriesStep);
});

test('a receipt still missing facts comes before the categories, on the board too', () => {
	const section = { section: 'Purchase details', reasons: ['Vendor missing.'] };
	const steps = requestSteps(view({ sections: [section] }), draft({ vendor: '' }), unconfirmed);
	const current = steps.find((step) => step.state === 'current');
	expect(current?.id).toBe('receipt');
	expect(current?.title).toBe(plainNextStep({ sections: [section] }, [], ['categories']));
});

test('the board follows step order when the event and the UO ID are both missing', () => {
	const sections = [
		{ section: 'Purchaser', reasons: ['Your UO ID (front and back) missing.'] },
		{ section: 'Event', reasons: ['Add the event date.'] }
	];
	const steps = requestSteps(
		view({ sections }),
		draft({
			activity: { ...draft().activity, dates: [] },
			purchaser: { ...draft().purchaser, idCardFrontFileId: null, idCardBackFileId: null }
		}),
		confirmed
	);
	const current = steps.find((step) => step.state === 'current');
	expect(current).toMatchObject({ id: 'event', title: 'Add the event date' });
	expect(plainNextStep({ sections }, [], [])).toBe(current?.title);
});

test('a defaulted event and payer are quick checks on the board too', () => {
	const sections = [{ section: 'Files', reasons: ['Publicity proof missing.'] }];
	const defaulted: StepContext = {
		reviewCount: 0,
		sourceOf: (field) => (field === 'activity' || field === 'purchaserSource' ? 'previous' : 'user')
	};
	const otherPayer = draft({
		publicityFileId: null,
		purchaserSource: { kind: 'purchaser', purchaserId: 'priya' }
	});
	const steps = requestSteps(view({ sections }), otherPayer, defaulted);
	expect(steps.filter((step) => step.state !== 'done').map((step) => step.title)).toEqual([
		'Check the event',
		'Check who paid',
		'Add proof the event was advertised',
		'Review and fill'
	]);
	expect(plainNextStep({ sections }, [], ['event', 'purchaser'])).toBe('Check the event');
	expect(plainNextStep({ sections }, [], ['purchaser'])).toBe('Check who paid');
	expect(
		unconfirmedSteps(
			{
				fieldSources: { activity: 'previous', purchaserSource: 'previous' },
				purchaserSource: { kind: 'purchaser', purchaserId: 'priya' as Id<'purchasers'> }
			},
			0
		)
	).toEqual(['categories', 'event', 'purchaser']);
	expect(
		unconfirmedSteps(
			{
				fieldSources: { documentationCategories: 'user', purchaserSource: 'previous' },
				purchaserSource: { kind: 'self' }
			},
			1
		)
	).toEqual(['receipt']);
});

test('suggested categories show in the summary and confirmed ones collapse', () => {
	const suggested = requestSteps(
		view(),
		draft({ documentationCategories: ['food', 'gifts_prizes'] }),
		unconfirmed
	);
	expect(suggested.find((step) => step.id === 'categories')?.summary).toBe('Food, Gifts or prizes');
	const done = requestSteps(view(), draft({ documentationCategories: ['asuo_funds'] }), confirmed);
	expect(done.find((step) => step.id === 'categories')).toMatchObject({
		state: 'done',
		title: 'What it includes',
		summary: 'Nothing special'
	});
});

test('toggling a category adds or drops its steps before readiness catches up', () => {
	const ids = (categories: string[]) =>
		requestSteps(
			view({ fundLetter: 'A' }),
			draft({ documentationCategories: categories }),
			confirmed
		).map((step) => step.id);
	expect(ids([])).not.toContain('recipients');
	const gifts = requestSteps(
		view({ fundLetter: 'A' }),
		draft({ documentationCategories: ['gifts_prizes'] }),
		confirmed
	);
	expect(gifts.find((step) => step.id === 'recipients')).toMatchObject({
		state: 'current',
		title: 'Add who received it'
	});
	const office = requestSteps(
		view({ fundLetter: 'A' }),
		draft({ documentationCategories: ['office_supplies_goods', 'printing_services'] }),
		confirmed
	);
	expect(office.filter((step) => step.state !== 'done').map((step) => step.title)).toEqual([
		'Add where it will be kept',
		'Add the printing invoice',
		'Review and fill'
	]);
	expect(ids(['asuo_funds'])).toContain('publicity');
	expect(ids(['merchandise_apparel'])).toEqual(expect.arrayContaining(['recipients', 'otherDocs']));
});

test('an event that hasn’t happened yet still reaches Business Purpose and Fill', () => {
	const ahead = view();
	Object.assign(ahead.purchase, { activity: { dates: ['2099-01-15'] } });
	const steps = requestSteps(
		ahead,
		draft({ activity: { ...draft().activity, dates: ['2099-01-15'] } }),
		confirmed
	);
	expect(steps.find((step) => step.state === 'current')).toMatchObject({
		id: 'review',
		title: 'Business Purpose'
	});
	expect(requestMode({ closed: false, reading: false, ready: true, steps })).toBe('ready');
	expect(requestMode({ closed: false, reading: false, ready: false, steps })).toBe('steps');
	expect(requestMode({ closed: false, reading: true, ready: false, steps })).toBe('reading');
});
