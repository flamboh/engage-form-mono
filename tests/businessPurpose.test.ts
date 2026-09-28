import { expect, test } from 'vitest';
import {
	formatActivityTime,
	mentionsPurpose,
	parseBusinessPurposeText,
	resolveBusinessPurpose,
	withPurpose
} from '../convex/businessPurpose';

test('withPurpose appends the purpose before the closing period', () => {
	expect(withPurpose('{Student Organization} bought {Item Description} on {Activity Date}.')).toBe(
		'{Student Organization} bought {Item Description} on {Activity Date} for {Purpose}.'
	);
	expect(withPurpose('Snacks for the club  ')).toBe('Snacks for the club for {Purpose}');
	expect(withPurpose('')).toBe('For {Purpose}.');
});

test('withPurpose leaves sentences that already mention the purpose alone', () => {
	expect(withPurpose('Prizes for {Purpose}.')).toBe('Prizes for {Purpose}.');
	expect(withPurpose('Prizes for {purpose}.')).toBe('Prizes for {purpose}.');
	expect(mentionsPurpose('Prizes for {Purposes}.')).toBe(false);
});

test('formatActivityTime turns input times into readable times', () => {
	expect(formatActivityTime('19:00')).toBe('7:00 PM');
	expect(formatActivityTime('00:30')).toBe('12:30 AM');
	expect(formatActivityTime('12:05')).toBe('12:05 PM');
	expect(formatActivityTime('noon')).toBe('noon');
});

test('Time and Location resolve in the Business Purpose', () => {
	const source = parseBusinessPurposeText(
		'Trivia night on {Activity Date} at {Time} in {Location}.'
	);
	const request = {
		activityDate: '2026-10-02',
		activityTime: '19:00',
		activityLocation: 'EMU Crater Lake Room'
	} as unknown as Parameters<typeof resolveBusinessPurpose>[1];
	expect(resolveBusinessPurpose(source, request)).toEqual({
		text: 'Trivia night on October 2, 2026 at 7:00 PM in EMU Crater Lake Room.',
		unresolved: []
	});
});

test('Time and Location fall back to legacy event fields and stay unresolved when empty', () => {
	const source = parseBusinessPurposeText('At {Time} in {Location}.');
	const legacy = { eventTime: '18:30', eventLocation: 'Knight Library' } as unknown as Parameters<
		typeof resolveBusinessPurpose
	>[1];
	expect(resolveBusinessPurpose(source, legacy).text).toBe('At 6:30 PM in Knight Library.');
	const empty = {} as unknown as Parameters<typeof resolveBusinessPurpose>[1];
	expect(resolveBusinessPurpose(source, empty).unresolved).toEqual([
		'activityTime',
		'activityLocation'
	]);
});
