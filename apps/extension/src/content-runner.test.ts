import { expect, test } from 'vitest';
import { samplePurchase } from '@engage-form/domain';
import type { FillAction } from '@engage-form/fill-engine';
import { createContentRunner, type FillRunState } from './content-runner.ts';

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
		loadPurchase: (purchaseId) =>
			Promise.resolve(purchaseId === samplePurchase.id ? samplePurchase : null),
		loadFillRun: () => state,
		saveFillRun(nextState) {
			state = nextState;
		},
		clearFillRun() {
			state = null;
		}
	});

	const result = await runner.startFillRun(samplePurchase);

	expect(result).toMatchObject({ ok: true, step: 'about', filled: 3 });
	expect(clickedNext).toBe(1);
	expect(receivedActions.length).toBeGreaterThan(0);
	expect(state).toEqual({ purchaseId: samplePurchase.id, filled: 3, pageCount: 1 });
});

test('records review reached when a saved run reaches review', async () => {
	let state: FillRunState | null = { purchaseId: samplePurchase.id, filled: 18, pageCount: 9 };
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
		loadPurchase() {
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
	expect(reviewMessages).toEqual([samplePurchase.id]);
	expect(state).toBeNull();
});

test('clears a run when the current step cannot be filled', async () => {
	let state: FillRunState | null = { purchaseId: samplePurchase.id, filled: 4, pageCount: 2 };
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
		loadPurchase: (purchaseId) =>
			Promise.resolve(purchaseId === samplePurchase.id ? samplePurchase : null),
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
	let state: FillRunState | null = { purchaseId: samplePurchase.id, filled: 4, pageCount: 2 };
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
		loadPurchase: () => Promise.resolve(null),
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
		message: 'Selected purchase is no longer cached in the extension.',
		step: 'claims',
		filled: 4,
		missed: []
	});
	expect(state).toBeNull();
});
