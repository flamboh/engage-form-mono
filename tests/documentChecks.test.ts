import { describe, expect, test } from 'vitest';
import type { Id } from '../convex/_generated/dataModel';
import {
	cardCandidates,
	eventDateCandidates,
	fulfillmentSignal,
	sameDay
} from '../convex/checks/candidates';
import {
	approvalBasisKey,
	confirmationFor,
	requestChecks,
	withConfirmation,
	type CheckDocument,
	type CheckInput
} from '../convex/checks/requestChecks';
import { withBlockingChecks } from '../convex/purchaseReadiness';
import { factQuestions, parseFacts, type DocumentFacts } from '../convex/extraction/facts';
import type { DocumentText } from '../convex/extraction/candidates';

const fileId = (name: string) => name as Id<'files'>;

function facts(overrides: Partial<DocumentFacts> = {}): DocumentFacts {
	return {
		itemized: true,
		cardLast4: '4242',
		fulfillment: 'in_person',
		food: false,
		mentionsFood: false,
		eventDates: [],
		dates: [],
		approverEmail: null,
		text: '',
		...overrides
	};
}

function receipt(
	name: string,
	overrides: Partial<DocumentFacts> = {},
	extra: Partial<CheckDocument> = {}
): CheckDocument {
	return {
		fileId: fileId(name),
		slot: 'receipt',
		vendor: 'Corner Market',
		total: '24.50',
		facts: facts(overrides),
		...extra
	};
}

function input(overrides: Partial<CheckInput> = {}): CheckInput {
	return {
		totalAmount: 24.5,
		vendor: 'Corner Market',
		itemDescription: 'Trail mix, sparkling water',
		categories: ['asuo_funds'],
		purchaserIsSelf: false,
		activity: { name: 'Weekly listening event', dates: ['2026-01-13'], location: 'McKenzie 240A' },
		recipients: [],
		foodIndividuallyPackaged: null,
		cateringWaiverAttached: false,
		confirmations: [],
		documents: [receipt('receipt_1')],
		...overrides
	};
}

const ids = (value: CheckInput) => requestChecks(value).map((check) => check.id);

describe('publicity', () => {
	const publicity = (overrides: Partial<DocumentFacts>): CheckDocument => ({
		fileId: fileId('flyer'),
		slot: 'publicity',
		vendor: '',
		total: '',
		facts: facts({ itemized: false, cardLast4: null, ...overrides })
	});

	test('passes when any date on it matches an event date, including dates without a year', () => {
		const value = input({
			documents: [
				receipt('r'),
				publicity({ dates: ['--01-06', '--01-13'], eventDates: ['--01-13'] })
			]
		});
		expect(ids(value)).not.toContain('publicity-date');
	});

	test('blocks when the publicity is for a different week', () => {
		const [check] = requestChecks(
			input({
				documents: [receipt('r'), publicity({ dates: ['--01-20'], eventDates: ['--01-20'] })]
			})
		);
		expect(check).toMatchObject({
			id: 'publicity-date',
			severity: 'blocking',
			action: 'upload',
			slot: 'publicity',
			fileId: 'flyer'
		});
		expect(check.detail).toBe(
			'It says Tuesday 01/20, but the event was Tuesday 01/13. Add publicity for this date.'
		);
	});

	test('asks for a confirmation when no date could be read, and remembers it per file', () => {
		const value = input({ documents: [receipt('r'), publicity({ dates: [] })] });
		const check = requestChecks(value).find((item) => item.id === 'publicity-date');
		expect(check).toMatchObject({ severity: 'warning', action: 'confirm' });
		const confirmation = confirmationFor(value, 'publicity-date')!;
		expect(ids({ ...value, confirmations: [confirmation] })).not.toContain('publicity-date');
		const replaced = {
			...value,
			documents: [receipt('r'), { ...publicity({}), fileId: fileId('new') }]
		};
		expect(ids({ ...replaced, confirmations: [confirmation] })).toContain('publicity-date');
	});

	test('skips the date check until the request has an event date', () => {
		const value = input({
			activity: { name: '', dates: [], location: '' },
			documents: [publicity({ dates: ['--01-20'] })]
		});
		expect(ids(value)).not.toContain('publicity-date');
	});

	test('warns when food was bought but the publicity never mentions it', () => {
		const food = input({
			foodIndividuallyPackaged: true,
			documents: [receipt('r', { food: true }), publicity({ dates: ['2026-01-13'] })]
		});
		expect(requestChecks(food).find((check) => check.id === 'publicity-food')).toMatchObject({
			severity: 'warning',
			action: 'upload'
		});
		const mentioned = {
			...food,
			documents: [
				receipt('r', { food: true }),
				publicity({ dates: ['2026-01-13'], mentionsFood: true })
			]
		};
		expect(ids(mentioned)).not.toContain('publicity-food');
	});
});

describe('food and catering waiver', () => {
	test('asks the packaging question when the receipt looks like food', () => {
		const [check] = requestChecks(input({ documents: [receipt('r', { food: true })] }));
		expect(check).toMatchObject({ id: 'food-packaging', severity: 'blocking', action: 'answer' });
	});

	test('asks the packaging question when the food category is on', () => {
		expect(ids(input({ categories: ['food'] }))).toContain('food-packaging');
	});

	test('individually packaged snacks need no waiver', () => {
		expect(ids(input({ categories: ['food'], foodIndividuallyPackaged: true }))).toEqual([]);
	});

	test('unpackaged food needs the waiver until it is attached', () => {
		const unpackaged = input({ categories: ['food'], foodIndividuallyPackaged: false });
		expect(requestChecks(unpackaged)[0]).toMatchObject({
			id: 'catering-waiver',
			severity: 'blocking',
			slot: 'catering_waiver',
			action: 'upload'
		});
		expect(ids({ ...unpackaged, cateringWaiverAttached: true })).toEqual([]);
	});

	test('pizza needs a waiver without asking about packaging', () => {
		const pizza = input({ categories: ['food'], itemDescription: '4 large pepperoni pizzas' });
		expect(ids(pizza)).toEqual(['catering-waiver']);
		expect(requestChecks(pizza)[0].detail).toContain('Bartolotti’s or Subway');
	});

	test('EMU vendors and UO Catering are exempt', () => {
		for (const vendor of ['Bartolotti’s Pizza', 'Subway', 'UO Catering']) {
			expect(ids(input({ categories: ['food'], vendor, itemDescription: 'Pizza' }))).toEqual([]);
		}
	});

	test('events on the Portland campus are exempt', () => {
		const portland = input({
			categories: ['food'],
			activity: { name: 'Mixer', dates: ['2026-01-13'], location: 'UO Portland, White Stag 142' }
		});
		expect(ids(portland)).toEqual([]);
	});
});

describe('receipts', () => {
	test('a card slip with only a total asks for an itemized receipt', () => {
		const slip = receipt('slip', { itemized: false, cardLast4: '5097' });
		const [check] = requestChecks(input({ documents: [slip] }));
		expect(check).toMatchObject({
			id: 'receipt-itemized:slip',
			severity: 'warning',
			fileId: 'slip',
			slot: 'receipt',
			action: 'upload'
		});
	});

	test('an itemized receipt from the same store covers the slip, and the slip covers its card digits', () => {
		const slip = receipt('slip', { itemized: false, cardLast4: '5097' });
		const handwritten = receipt('handwritten', { itemized: true, cardLast4: null });
		expect(ids(input({ documents: [slip, handwritten] }))).toEqual([]);
	});

	test('an unrelated receipt does not cover a missing item list', () => {
		const slip = receipt('slip', { itemized: false }, { vendor: 'Record Shop', total: '19.00' });
		const other = receipt('other', {}, { vendor: 'Corner Market', total: '24.50' });
		expect(ids(input({ documents: [slip, other] }))).toEqual(['receipt-itemized:slip']);
	});

	test('warns when the card digits are not visible', () => {
		expect(ids(input({ documents: [receipt('r', { cardLast4: null })] }))).toEqual([
			'receipt-card:r'
		]);
	});

	test('a future arrival asks for the shipped invoice unless another receipt shows it shipped', () => {
		const arriving = receipt('arriving', { fulfillment: 'pending' }, { vendor: 'Amazon' });
		expect(ids(input({ documents: [arriving] }))).toEqual(['receipt-shipped:arriving']);
		const delivered = receipt('delivered', { fulfillment: 'delivered' }, { vendor: 'Amazon.com' });
		expect(ids(input({ documents: [arriving, delivered] }))).toEqual([]);
	});

	test('documents still being read produce no checks', () => {
		expect(ids(input({ documents: [{ ...receipt('r'), facts: null }] }))).toEqual([]);
	});
});

describe('second approval', () => {
	const approval = (text: string, total: string, overrides: Partial<DocumentFacts> = {}) => ({
		fileId: fileId('approval'),
		slot: 'second_approval' as const,
		vendor: '',
		total,
		facts: facts({ itemized: false, cardLast4: null, text, ...overrides })
	});
	const matching = approval(
		'I approve the purchase of trail mix and sparkling water from Corner Market, totaling $24.50, for the Weekly listening event on Tuesday 01/13.',
		'24.50',
		{ dates: ['--01-13'], eventDates: ['--01-13'] }
	);
	const self = (documents: CheckDocument[], overrides: Partial<CheckInput> = {}) =>
		input({ purchaserIsSelf: true, documents: [receipt('r'), ...documents], ...overrides });

	test('a matching approval passes', () => {
		expect(ids(self([matching]))).toEqual([]);
	});

	test('blocks when the approved total differs', () => {
		const [check] = requestChecks(self([{ ...matching, total: '32.98' }]));
		expect(check).toMatchObject({ id: 'approval-total', severity: 'blocking', action: 'upload' });
		expect(check.detail).toBe(
			'It approves $32.98, but this request is $24.50. Get a new approval for this purchase.'
		);
	});

	test('warns when an approval reused from another purchase names other items', () => {
		const reused = approval('I approve the vinyl record from Amazon, totaling $24.50.', '24.50', {
			dates: ['--01-13']
		});
		expect(ids(self([reused]))).toEqual(['approval-items']);
	});

	test('warns when the approval names no event or date', () => {
		const vague = approval('Approved! Trail mix and sparkling water, $24.50 total.', '24.50');
		const check = requestChecks(self([vague])).find((item) => item.id === 'approval-event');
		expect(check).toMatchObject({
			severity: 'warning',
			title: 'Second approval doesn’t name the event'
		});
		expect(check?.detail).toBe(
			'Reviewers want it to say which event and date it’s for, like “Weekly listening event on Tuesday 01/13”.'
		);
	});

	test('the event name alone counts as naming the event', () => {
		const named = approval('Approved trail mix for the listening event, $24.50.', '24.50');
		expect(ids(self([named]))).toEqual([]);
	});

	test('warns when the approval is for a different date', () => {
		const other = approval('Approved trail mix, $24.50, for Tuesday 1/20.', '24.50', {
			dates: ['--01-20'],
			eventDates: ['--01-20']
		});
		expect(requestChecks(self([other]))[0]).toMatchObject({
			id: 'approval-event',
			title: 'Second approval is for a different date'
		});
	});

	test('asks to recheck after the purchase facts change, until confirmed', () => {
		const attached = self([{ ...matching, total: '' }]);
		const basis = { id: 'approval-recheck', key: approvalBasisKey(attached) };
		expect(ids({ ...attached, confirmations: [basis] })).toEqual([]);
		const changed = { ...attached, totalAmount: 30, confirmations: [basis] };
		expect(requestChecks(changed)[0]).toMatchObject({
			id: 'approval-recheck',
			severity: 'warning',
			action: 'confirm'
		});
		const confirmed = withConfirmation(
			changed.confirmations,
			confirmationFor(changed, 'approval-recheck')!
		);
		expect(confirmed).toHaveLength(1);
		expect(ids({ ...changed, confirmations: confirmed })).toEqual([]);
	});

	test('facts filled in after attaching are not a change', () => {
		const empty = self([{ ...matching, total: '' }], {
			totalAmount: 0,
			vendor: '',
			itemDescription: '',
			activity: { name: '', dates: [], location: '' }
		});
		const basis = { id: 'approval-recheck', key: approvalBasisKey(empty) };
		expect(ids(self([{ ...matching, total: '' }], { confirmations: [basis] }))).toEqual([]);
	});

	test('only applies to self reimbursement', () => {
		expect(ids(input({ documents: [receipt('r'), { ...matching, total: '1.00' }] }))).toEqual([]);
	});
});

describe('recipients', () => {
	const prizes = (
		recipients: { name: string; uo95: string }[],
		confirmations: CheckInput['confirmations'] = []
	) => input({ categories: ['gifts_prizes'], recipients, confirmations });

	test('blocks a 95# that is not 9 digits starting with 95', () => {
		const checks = requestChecks(prizes([{ name: 'Casey Park', uo95: '12345' }]));
		expect(checks[0]).toMatchObject({
			id: 'recipient-id:0',
			severity: 'blocking',
			title: 'Fix Casey Park’s 95#',
			action: null
		});
	});

	test('asks once per recipient to double-check the 95#', () => {
		const value = prizes([
			{ name: 'Casey Park', uo95: '951 234 567' },
			{ name: 'Robin Vale', uo95: '950000001' }
		]);
		expect(requestChecks(value).map((check) => check.title)).toEqual([
			'Double-check that Casey Park’s 95# is theirs',
			'Double-check that Robin Vale’s 95# is theirs'
		]);
		const first = confirmationFor(value, 'recipient-confirm:0')!;
		expect(first.key).toBe('casey park|951234567');
		const confirmed = { ...value, confirmations: [first] };
		expect(ids(confirmed)).toEqual(['recipient-confirm:1']);
		const edited = prizes([{ name: 'Casey Park', uo95: '951234568' }], [first]);
		expect(ids(edited)).toEqual(['recipient-confirm:0']);
	});
});

test('blocking checks make the request not ready, warnings do not', () => {
	const ready = { ready: true, sections: [] };
	expect(withBlockingChecks(ready, [{ severity: 'warning', title: 'Card' }])).toBe(ready);
	expect(
		withBlockingChecks(ready, [{ severity: 'blocking', title: 'Add the catering waiver' }])
	).toEqual({
		ready: false,
		sections: [{ section: 'Document checks', reasons: ['Add the catering waiver'] }]
	});
});

describe('fact candidates', () => {
	test('finds card digits after masks and card words, not merchant IDs alone', () => {
		const cards = cardCandidates([
			'VISA 1111',
			'XXXXXXXXXXXX1111',
			'MID: ************9999',
			'Order # 113-1671071',
			'Payment from Visa ... 2222',
			'* * * * k 3333',
			'Card ending in',
			'4444'
		]).map((card) => card.digits);
		expect(cards).toEqual(['1111', '9999', '2222', '3333', '4444']);
	});

	test('reads event dates with and without a year', () => {
		const dates = eventDateCandidates([
			'Tuesday, January 13, 2026',
			'Tues Jan 20 · 6:30pm',
			'Join us 1/27 at 6:30pm',
			'2 for $5.00'
		]).map((candidate) => candidate.date);
		expect(dates).toEqual(['2026-01-13', '--01-20', '--01-27']);
		expect(sameDay('--01-20', '2026-01-20')).toBe(true);
		expect(sameDay('2025-01-20', '2026-01-20')).toBe(false);
	});

	test('reads fulfillment wording', () => {
		expect(fulfillmentSignal(['Arriving Monday', 'Ship to'])).toBe('pending');
		expect(fulfillmentSignal(['Delivered November 3', 'Ship to'])).toBe('delivered');
		expect(fulfillmentSignal(['Your order has shipped'])).toBe('shipped');
		expect(fulfillmentSignal(['Thank you for shopping'])).toBeNull();
	});

	test('asks Jev once per candidate and keeps code in charge of the answer', () => {
		const text: DocumentText = {
			source: 'textract',
			lines: ['CORNER MARKET', 'Total $24.50', 'VISA 4242', 'MID: ****9999', 'Arriving Monday'],
			hints: { vendorNames: [], itemNames: [] }
		};
		const { questions, plan } = factQuestions(text);
		expect(Object.keys(questions).sort()).toEqual([
			'card_last4',
			'food',
			'fulfillment',
			'itemized',
			'mentions_food'
		]);
		const parsed = parseFacts(
			plan,
			text,
			{
				itemized: { type: 'noul', noul: 0.1 },
				food: { type: 'noul', noul: 0.9 },
				mentions_food: { type: 'noul', noul: 0.1 },
				card_last4: {
					type: 'choice',
					choice: '4242',
					probabilities: { '4242': 0.97, '9999': 0.02, none: 0.01 },
					confidence: 0.95
				},
				fulfillment: {
					type: 'choice',
					choice: 'in_person',
					probabilities: { in_person: 0.6, pending: 0.4, delivered: 0, shipped: 0 },
					confidence: 0.3
				}
			},
			[]
		);
		expect(parsed).toMatchObject({
			itemized: false,
			cardLast4: '4242',
			fulfillment: 'pending',
			food: true
		});
	});
});
