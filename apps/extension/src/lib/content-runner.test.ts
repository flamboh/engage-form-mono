import { expect, test } from 'vitest';
import { samplePurchaseRequest } from '@engage-form/domain';
import type { FillAction } from '@engage-form/fill-engine';
import { createContentRunner, fillLabel, type FillRunState } from './content-runner';

test('starts a complete fill run and advances the current step', async () => {
	let state: FillRunState | null = null;
	let clickedNext = 0;
	let receivedActions: FillAction[] = [];
	const runner = createContentRunner({
		pageHeading: () => 'About You, Your Org, and Business Purpose',
		applyFillPlan(actions) {
			receivedActions = actions;
			return Promise.resolve({ filled: 3, missed: [], message: 'Filled current page.' });
		},
		clickNextStep() {
			clickedNext += 1;
			return true;
		},
		sendReviewReached() {
			throw new Error('Review should not be reached yet.');
		},
		loadPurchaseRequest: (purchaseId) =>
			Promise.resolve(purchaseId === samplePurchaseRequest.id ? samplePurchaseRequest : null),
		loadFillRun: () => state,
		saveFillRun(nextState) {
			state = nextState;
		},
		clearFillRun() {
			state = null;
		}
	});

	const result = await runner.startFillRun(samplePurchaseRequest);

	expect(result).toMatchObject({ ok: true, step: 'about', filled: 3 });
	expect(clickedNext).toBe(1);
	expect(receivedActions.length).toBeGreaterThan(0);
	expect(state).toEqual({
		purchaseId: samplePurchaseRequest.id,
		filled: 3,
		pageCount: 1,
		label: 'Amazon · $22.98'
	});
});

test('records review reached when a saved run reaches review', async () => {
	let state: FillRunState | null = {
		purchaseId: samplePurchaseRequest.id,
		filled: 18,
		pageCount: 9,
		label: 'Amazon · $22.98'
	};
	const reviewMessages: string[] = [];
	const runner = createContentRunner({
		pageHeading: () => 'Review Submission',
		applyFillPlan() {
			throw new Error('Review should not fill fields.');
		},
		clickNextStep() {
			throw new Error('Review should not advance.');
		},
		sendReviewReached(purchaseId) {
			reviewMessages.push(purchaseId);
		},
		loadPurchaseRequest() {
			throw new Error('Review should not load purchase.');
		},
		loadFillRun: () => state,
		saveFillRun(nextState) {
			state = nextState;
		},
		clearFillRun() {
			state = null;
		}
	});

	const result = await runner.continueFillRun();

	expect(result).toEqual({
		ok: true,
		message: 'Review reached. Filled 18 fields.',
		step: 'review',
		filled: 18,
		missed: []
	});
	expect(reviewMessages).toEqual([samplePurchaseRequest.id]);
	expect(state).toBeNull();
});

test('clears a run when the current step cannot be filled', async () => {
	let state: FillRunState | null = {
		purchaseId: samplePurchaseRequest.id,
		filled: 4,
		pageCount: 2,
		label: 'Amazon · $22.98'
	};
	const runner = createContentRunner({
		pageHeading: () => 'Mandatory Claims',
		applyFillPlan() {
			return Promise.resolve({
				filled: 1,
				missed: ['checkbox:no alcohol'],
				message: 'Filled 1; missed checkbox:no alcohol.'
			});
		},
		clickNextStep() {
			throw new Error('Missed fields should stop before advancing.');
		},
		sendReviewReached() {
			throw new Error('Review should not be reached.');
		},
		loadPurchaseRequest: (purchaseId) =>
			Promise.resolve(purchaseId === samplePurchaseRequest.id ? samplePurchaseRequest : null),
		loadFillRun: () => state,
		saveFillRun(nextState) {
			state = nextState;
		},
		clearFillRun() {
			state = null;
		}
	});

	const result = await runner.continueFillRun();

	expect(result).toMatchObject({ ok: false, step: 'claims', filled: 5 });
	expect(state).toBeNull();
});

test('clears a run when the cached purchase is missing', async () => {
	let state: FillRunState | null = {
		purchaseId: samplePurchaseRequest.id,
		filled: 4,
		pageCount: 2,
		label: 'Amazon · $22.98'
	};
	const runner = createContentRunner({
		pageHeading: () => 'Mandatory Claims',
		applyFillPlan() {
			throw new Error('Missing purchase should stop before filling.');
		},
		clickNextStep() {
			throw new Error('Missing purchase should stop before advancing.');
		},
		sendReviewReached() {
			throw new Error('Review should not be reached.');
		},
		loadPurchaseRequest: () => Promise.resolve(null),
		loadFillRun: () => state,
		saveFillRun(nextState) {
			state = nextState;
		},
		clearFillRun() {
			state = null;
		}
	});

	const result = await runner.continueFillRun();

	expect(result).toEqual({
		ok: false,
		message: 'Selected purchase request could not be loaded from Convex.',
		step: 'claims',
		filled: 4,
		missed: []
	});
	expect(state).toBeNull();
});

test('does not advance when the run is cancelled mid-page', async () => {
	let state: FillRunState | null = null;
	const runner = createContentRunner({
		pageHeading: () => 'Mandatory Claims',
		applyFillPlan() {
			state = null;
			return Promise.resolve({ filled: 4, missed: [], message: 'Filled current page.' });
		},
		clickNextStep() {
			throw new Error('Cancelled runs should not advance.');
		},
		sendReviewReached() {
			throw new Error('Review should not be reached.');
		},
		loadPurchaseRequest: () => Promise.resolve(samplePurchaseRequest),
		loadFillRun: () => state,
		saveFillRun(nextState) {
			state = nextState;
		},
		clearFillRun() {
			state = null;
		}
	});

	const result = await runner.startFillRun(samplePurchaseRequest, 'Costco · $45.98');

	expect(result).toMatchObject({ ok: false, message: 'Fill cancelled.', step: 'claims' });
	expect(state).toBeNull();
});

test('labels a fill run by vendor and amount', () => {
	expect(fillLabel({ vendor: 'Costco', itemDescription: 'Snacks', totalAmount: 45.98 })).toBe(
		'Costco · $45.98'
	);
	expect(fillLabel({ vendor: ' ', itemDescription: 'Snacks', totalAmount: 5 })).toBe(
		'Snacks · $5.00'
	);
	expect(fillLabel({ vendor: '', itemDescription: '', totalAmount: 5 })).toBe('$5.00');
});
