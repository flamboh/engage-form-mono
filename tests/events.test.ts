import { expect, test } from 'vitest';
import { formatEventDates, formatEventTime, suggestEventDates } from '../convex/events';

test('weekly events suggest the next matching weekday and the one before it', () => {
	expect(suggestEventDates({ weekday: 2 }, '2026-05-17')).toEqual({
		suggested: '2026-05-19',
		alternatives: ['2026-05-12']
	});
	expect(suggestEventDates({ weekday: 2 }, '2026-05-19')).toEqual({
		suggested: '2026-05-19',
		alternatives: ['2026-05-12']
	});
	expect(suggestEventDates({ weekday: 2 }, '2026-05-20')).toEqual({
		suggested: '2026-05-26',
		alternatives: ['2026-05-19']
	});
});

test('one-off events suggest the receipt date, and nothing without a receipt date', () => {
	expect(suggestEventDates({ weekday: null }, '2026-05-22')).toEqual({
		suggested: '2026-05-22',
		alternatives: []
	});
	expect(suggestEventDates({ weekday: 2 }, null)).toEqual({ suggested: null, alternatives: [] });
	expect(suggestEventDates({ weekday: 2 }, '05/22/2026')).toEqual({
		suggested: null,
		alternatives: []
	});
});

test('event dates compute their weekday and group a shared weekday', () => {
	expect(formatEventDates(['2026-05-26'])).toBe('Tuesday 05/26');
	expect(formatEventDates(['2026-05-26', '2026-05-12', '2026-05-19', '2026-05-19'])).toBe(
		'Tuesdays (05/12, 05/19, 05/26)'
	);
	expect(formatEventDates(['2026-05-22', '2026-05-19'])).toBe('Tuesday 05/19 and Friday 05/22');
	expect(formatEventDates(['2026-05-19', '2026-05-22', '2026-05-23'])).toBe(
		'Tuesday 05/19, Friday 05/22, and Saturday 05/23'
	);
	expect(formatEventDates(['', 'not a date', '2026-02-30'])).toBe('');
});

test('event times read like a person wrote them', () => {
	expect(formatEventTime('18:30')).toBe('6:30pm');
	expect(formatEventTime('18:00')).toBe('6pm');
	expect(formatEventTime('09:05')).toBe('9:05am');
	expect(formatEventTime('00:00')).toBe('12am');
	expect(formatEventTime('12:15')).toBe('12:15pm');
});
