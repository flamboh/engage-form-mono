import { expect, test } from 'vitest';
import {
	customTextOmissions,
	generateBusinessPurpose,
	missingFactLabel,
	type BusinessPurposeFacts
} from '../convex/businessPurpose';

function facts(overrides: Partial<BusinessPurposeFacts> = {}): BusinessPurposeFacts {
	return {
		organization: 'Chess Club',
		purchaser: 'Jordan Lee',
		vendor: 'Target',
		items: 'snacks',
		total: 24.5,
		purpose: '',
		eventName: 'Weekly chess night',
		dates: ['2026-04-07'],
		time: '19:00',
		location: 'EMU 101',
		attendance: 30,
		openToAllStudents: true,
		recipients: [],
		recipientsRequired: false,
		today: '2026-04-10',
		...overrides
	};
}

test('writes two past-tense sentences with every required fact', () => {
	expect(generateBusinessPurpose(facts())).toEqual({
		text: 'Chess Club wishes to reimburse Jordan Lee because they purchased snacks from Target for $24.50. The snacks were used at Chess Club’s weekly chess night on Tuesday 04/07 at 7pm in EMU 101, with about 30 students in attendance.',
		missing: []
	});
});

test('names each prize recipient with their 95# and reason', () => {
	const { text, missing } = generateBusinessPurpose(
		facts({
			items: 'a board game',
			recipientsRequired: true,
			recipients: [{ name: 'Sam Rivera', uo95: '951000001', reason: 'winning the tournament' }]
		})
	);
	expect(missing).toEqual([]);
	expect(text).toContain(
		'The board game was given to Sam Rivera (951000001) for winning the tournament at Chess Club’s weekly chess night'
	);
});

test('lists several recipients', () => {
	const { text } = generateBusinessPurpose(
		facts({
			items: 'two puzzle books',
			recipientsRequired: true,
			recipients: [
				{ name: 'Sam Rivera', uo95: '951000001', reason: 'first place' },
				{ name: 'Avery Chen', uo95: '951000002', reason: 'second place' }
			]
		})
	);
	expect(text).toContain(
		'were given to Sam Rivera (951000001) for first place and Avery Chen (951000002) for second place'
	);
});

test('recurring supplies list concrete dates', () => {
	const { text } = generateBusinessPurpose(
		facts({
			items: 'candy',
			dates: ['2026-04-07', '2026-04-14', '2026-04-21'],
			today: '2026-04-22'
		})
	);
	expect(text).toContain(
		'The candy was used at Chess Club’s weekly chess night on Tuesdays (04/07, 04/14, 04/21) at 7pm in EMU 101, with about 30 students at each event.'
	);
});

test('weaves in what it was for', () => {
	expect(generateBusinessPurpose(facts({ purpose: 'a snack table' })).text).toContain(
		'The snacks were used for a snack table at'
	);
});

test('never leaves a blank where a fact is missing', () => {
	const { text, missing } = generateBusinessPurpose(
		facts({ attendance: null, time: '', location: '', dates: [], eventName: '' })
	);
	expect(missing).toEqual(['eventName', 'dates', 'time', 'location', 'attendance']);
	expect(text).not.toMatch(/about\s+students|\bon\s+at\b|\{|\}|undefined|null/);
	expect(missing.map(missingFactLabel)).toContain('Add how many students attended');
});

test('requires complete recipients when gifts or merchandise are selected', () => {
	expect(generateBusinessPurpose(facts({ recipientsRequired: true })).missing).toEqual([
		'recipients'
	]);
	expect(
		generateBusinessPurpose(
			facts({ recipients: [{ name: 'Sam Rivera', uo95: '', reason: 'winning' }] })
		).missing
	).toEqual(['recipients']);
});

test('private events say members, not students', () => {
	expect(generateBusinessPurpose(facts({ openToAllStudents: false })).text).toContain(
		'with about 30 members in attendance'
	);
});

test('customized text is checked for the facts it seems to omit', () => {
	expect(
		customTextOmissions(
			'We bought snacks from Target for $24.50 on 04/07 for 30 students.',
			facts()
		)
	).toEqual([]);
	expect(customTextOmissions('We bought snacks.', facts())).toEqual([
		'vendor',
		'total',
		'attendance',
		'dates'
	]);
});
