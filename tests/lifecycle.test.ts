import { describe, expect, test } from 'vitest';
import {
	daysLeft,
	effectiveStatus,
	finishAfter,
	reimbursementDeadline,
	requestLifecycle,
	requestStage,
	todayInEugene
} from '../convex/lifecycle';

const today = '2026-09-29';

const draft = {
	status: 'draft' as const,
	lastFilledAt: null,
	reading: false,
	receiptFactsComplete: true,
	activityDates: ['2026-10-06'],
	daysLeft: 20,
	today
};

describe('requestStage', () => {
	test('stored status wins over everything else', () => {
		expect(requestStage({ ...draft, status: 'approved', reading: true })).toBe('approved');
		expect(requestStage({ ...draft, status: 'ready', lastFilledAt: 1 })).toBe('filled');
		expect(requestStage({ ...draft, status: 'ready', reading: true, daysLeft: -3 })).toBe('ready');
	});

	test('a draft being read is reading', () => {
		expect(requestStage({ ...draft, reading: true })).toBe('reading');
	});

	test('a draft with its receipt facts waits for an event that is today, later, or undated', () => {
		expect(requestStage(draft)).toBe('after_event');
		expect(requestStage({ ...draft, activityDates: [today] })).toBe('after_event');
		expect(requestStage({ ...draft, activityDates: [] })).toBe('after_event');
		expect(requestStage({ ...draft, daysLeft: null })).toBe('after_event');
	});

	test('a past event or missing receipt facts means to finish', () => {
		expect(requestStage({ ...draft, activityDates: ['2026-09-28'] })).toBe('to_finish');
		expect(requestStage({ ...draft, receiptFactsComplete: false })).toBe('to_finish');
	});

	test('a multi-date activity waits for its latest date', () => {
		expect(requestStage({ ...draft, activityDates: ['2026-09-01', '2026-10-13'] })).toBe(
			'after_event'
		);
		expect(requestStage({ ...draft, activityDates: ['2026-09-28', '2026-09-01'] })).toBe(
			'to_finish'
		);
	});

	test('the last week promotes a tracked draft to to finish', () => {
		expect(requestStage({ ...draft, daysLeft: 8 })).toBe('after_event');
		expect(requestStage({ ...draft, daysLeft: 7 })).toBe('to_finish');
		expect(requestStage({ ...draft, daysLeft: 0 })).toBe('to_finish');
		expect(requestStage({ ...draft, daysLeft: -4 })).toBe('to_finish');
	});
});

describe('dates', () => {
	test('the reimbursement window is 30 days from the receipt date', () => {
		expect(reimbursementDeadline('2026-09-20')).toBe('2026-10-20');
		expect(reimbursementDeadline('2026-02-10')).toBe('2026-03-12');
		expect(reimbursementDeadline(null)).toBeNull();
		expect(reimbursementDeadline('Sep 20')).toBeNull();
	});

	test('days left goes negative once the deadline passes', () => {
		expect(daysLeft(reimbursementDeadline('2026-09-04'), today)).toBe(5);
		expect(daysLeft(reimbursementDeadline('2026-08-29'), today)).toBe(-1);
		expect(daysLeft('2026-09-29', today)).toBe(0);
		expect(daysLeft(null, today)).toBeNull();
	});

	test('finish after is the latest valid activity date', () => {
		expect(finishAfter(['2026-10-06', '2026-09-30', '2026-10-13'])).toBe('2026-10-13');
		expect(finishAfter(['--05-19'])).toBeNull();
		expect(finishAfter([])).toBeNull();
	});

	test('today is the date in Eugene, not UTC', () => {
		expect(todayInEugene(Date.parse('2026-09-30T06:30:00Z'))).toBe('2026-09-29');
		expect(todayInEugene(Date.parse('2026-09-30T07:00:00Z'))).toBe('2026-09-30');
		expect(todayInEugene(Date.parse('2026-01-15T07:30:00Z'))).toBe('2026-01-14');
		expect(todayInEugene(Date.parse('2026-01-15T08:00:00Z'))).toBe('2026-01-15');
	});

	test('a 23:30 event day in Eugene is still after the event, not past it', () => {
		const lateNight = todayInEugene(Date.parse('2026-10-07T06:30:00Z'));
		expect(requestStage({ ...draft, today: lateNight })).toBe('after_event');
		const nextMorning = todayInEugene(Date.parse('2026-10-07T08:00:00Z'));
		expect(requestStage({ ...draft, today: nextMorning })).toBe('to_finish');
	});
});

describe('requestLifecycle', () => {
	const request = {
		status: 'draft' as const,
		lastFilledAt: null,
		reviewerNote: null,
		vendor: 'Trader Joe’s',
		itemDescription: 'snacks',
		totalAmount: 23.1,
		receiptFileIds: ['file_receipt'],
		receiptDate: '2026-09-27',
		activity: { dates: ['2026-10-06'] }
	};
	const context = { reading: false, readinessReady: false, today };

	test('a tracked draft carries its deadline and finish-after date', () => {
		expect(requestLifecycle(request, context)).toEqual({
			stage: 'after_event',
			finishAfter: '2026-10-06',
			deadline: '2026-10-27',
			daysLeft: 28
		});
	});

	test('a draft that passes readiness is ready to fill, even before its event', () => {
		expect(requestLifecycle(request, { ...context, readinessReady: true }).stage).toBe('ready');
	});

	test('reading keeps a complete draft out of ready, and sent back is always to finish', () => {
		expect(
			requestLifecycle(request, { ...context, readinessReady: true, reading: true }).stage
		).toBe('reading');
		expect(
			requestLifecycle({ ...request, reviewerNote: '' }, { ...context, readinessReady: true }).stage
		).toBe('to_finish');
	});

	test('a ready request that stops passing readiness goes back to to finish', () => {
		expect(
			requestLifecycle(
				{ ...request, status: 'ready', lastFilledAt: 5, activity: { dates: ['2026-09-01'] } },
				context
			).stage
		).toBe('to_finish');
	});

	test('missing receipt facts are never tracked', () => {
		expect(requestLifecycle({ ...request, receiptFileIds: [] }, context).stage).toBe('to_finish');
		expect(requestLifecycle({ ...request, vendor: ' ' }, context).stage).toBe('to_finish');
		expect(requestLifecycle({ ...request, totalAmount: 0 }, context).stage).toBe('to_finish');
	});
});

test('effective status keeps approved and otherwise follows readiness', () => {
	expect(effectiveStatus({ status: 'approved', readinessReady: false, sentBack: true })).toBe(
		'approved'
	);
	expect(effectiveStatus({ status: 'draft', readinessReady: true, sentBack: false })).toBe('ready');
	expect(effectiveStatus({ status: 'ready', readinessReady: false, sentBack: false })).toBe(
		'draft'
	);
});
