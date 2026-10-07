import { expect, test } from 'vitest';
import { formatEventDates, formatEventTime, suggestEventDates } from '../convex/events';

test('weekly events suggest the most recent occurrence, with the weeks around it', () => {
	expect(suggestEventDates({ weekday: 3 }, null, '2026-10-09')).toEqual({
		suggested: '2026-10-07',
		dates: ['2026-09-30', '2026-10-07', '2026-10-14']
	});
	expect(suggestEventDates({ weekday: 3 }, '2026-10-05', '2026-10-09')).toEqual({
		suggested: '2026-10-07',
		dates: ['2026-09-30', '2026-10-07', '2026-10-14']
	});
});

test('an event on today’s weekday suggests today', () => {
	expect(suggestEventDates({ weekday: 3 }, null, '2026-10-07')).toEqual({
		suggested: '2026-10-07',
		dates: ['2026-09-30', '2026-10-07', '2026-10-14']
	});
	expect(suggestEventDates({ weekday: 3 }, '2026-10-07', '2026-10-07')).toEqual({
		suggested: '2026-10-07',
		dates: ['2026-09-30', '2026-10-07', '2026-10-14']
	});
});

test('a receipt after the last occurrence suggests the next one', () => {
	expect(suggestEventDates({ weekday: 3 }, '2026-10-08', '2026-10-09')).toEqual({
		suggested: '2026-10-14',
		dates: ['2026-10-07', '2026-10-14', '2026-10-21']
	});
});

test('an older receipt keeps the first occurrence after it as a choice', () => {
	expect(suggestEventDates({ weekday: 3 }, '2026-09-10', '2026-10-09')).toEqual({
		suggested: '2026-10-07',
		dates: ['2026-09-16', '2026-09-30', '2026-10-07', '2026-10-14']
	});
});

test('a receipt dated after today is ignored', () => {
	expect(suggestEventDates({ weekday: 3 }, '2026-11-20', '2026-10-09')).toEqual({
		suggested: '2026-10-07',
		dates: ['2026-09-30', '2026-10-07', '2026-10-14']
	});
});

test('one-off events suggest the receipt date, and nothing without a receipt date', () => {
	expect(suggestEventDates({ weekday: null }, '2026-10-02', '2026-10-09')).toEqual({
		suggested: '2026-10-02',
		dates: ['2026-10-02']
	});
	expect(suggestEventDates({ weekday: null }, null, '2026-10-09')).toEqual({
		suggested: null,
		dates: []
	});
	expect(suggestEventDates({ weekday: null }, '10/02/2026', '2026-10-09')).toEqual({
		suggested: null,
		dates: []
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
