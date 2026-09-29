import { describe, expect, it } from 'vitest';
import { omittedFacts } from '../apps/web/src/lib/request/purposeCheck';

const facts = {
	vendor: 'Market of Choice',
	totalAmount: 1236.18,
	attendance: 50,
	dates: ['2026-05-26']
};

describe('omittedFacts', () => {
	it('accepts custom text that keeps every fact', () => {
		expect(
			omittedFacts(
				'Paid $1,236.18 at market of choice for Tuesday 05/26 with about 50 students.',
				facts
			)
		).toEqual([]);
	});

	it('flags each fact the text leaves out', () => {
		expect(omittedFacts('Snacks for the meeting.', facts)).toEqual([
			'vendor',
			'total',
			'attendance',
			'dates'
		]);
	});

	it('reads month names and short numeric dates', () => {
		expect(
			omittedFacts('Held May 26.', { ...facts, vendor: '', totalAmount: null, attendance: null })
		).toEqual([]);
		expect(
			omittedFacts('Held 5/26.', { ...facts, vendor: '', totalAmount: null, attendance: null })
		).toEqual([]);
	});

	it('does not match the attendance inside a larger number', () => {
		expect(
			omittedFacts('About 150 came.', { ...facts, vendor: '', totalAmount: null, dates: [] })
		).toEqual(['attendance']);
	});

	it('skips facts that are not known yet', () => {
		expect(
			omittedFacts('Anything.', { vendor: '', totalAmount: null, attendance: null, dates: [] })
		).toEqual([]);
	});
});
