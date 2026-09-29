import { expect, test } from 'vitest';
import { autoStartDecision, isFirstFormStep } from './pending-fill';

const formUrl = 'https://uoregon.campuslabs.com/engage/submitter/form/start/730239';
const stepUrl = 'https://uoregon.campuslabs.com/engage/submitter/form/step/1?Guid=abc';
const pendingFill = {
	purchaseRequestId: 'purchase_1',
	requestedAt: 1_800_000_000_000,
	label: 'Costco · $45.98',
	engageUrl: formUrl
};

function decide(overrides: Partial<Parameters<typeof autoStartDecision>[0]> = {}) {
	return autoStartDecision({
		url: formUrl,
		step: 'formStart',
		activeRun: false,
		state: { signedIn: true, pendingFill },
		connectDismissed: false,
		confirmDismissed: false,
		...overrides
	});
}

test('starts a pending fill on the form start page', () => {
	expect(decide()).toEqual({ type: 'start', pendingFill });
	expect(decide({ step: 'about' })).toEqual({ type: 'start', pendingFill });
});

test('starts on the first detected step of a new form', () => {
	expect(decide({ url: stepUrl, step: 'organizationRepresentation' })).toEqual({
		type: 'start',
		pendingFill
	});
	expect(decide({ url: stepUrl, step: 'formStart' })).toEqual({ type: 'start', pendingFill });
});

test('asks before filling a later step', () => {
	expect(decide({ url: stepUrl, step: 'about' })).toEqual({ type: 'confirm', pendingFill });
	expect(decide({ url: stepUrl, step: 'documentation' })).toEqual({
		type: 'confirm',
		pendingFill
	});
});

test('stays quiet on later steps after Not now', () => {
	expect(decide({ url: stepUrl, step: 'about', confirmDismissed: true })).toEqual({
		type: 'idle'
	});
});

test('ignores pages outside the Engage submitter form', () => {
	expect(decide({ url: 'https://uoregon.campuslabs.com/engage/organizations' })).toEqual({
		type: 'idle'
	});
});

test('waits for a recognized purchase request step and never starts on review', () => {
	expect(decide({ step: 'unknown' })).toEqual({ type: 'idle' });
	expect(decide({ step: 'review' })).toEqual({ type: 'idle' });
});

test('lets an active fill run resume instead of starting again', () => {
	expect(decide({ activeRun: true })).toEqual({ type: 'idle' });
});

test('stays idle without a pending fill', () => {
	expect(decide({ state: { signedIn: true, pendingFill: null } })).toEqual({ type: 'idle' });
});

test('asks to connect when the extension has no token', () => {
	expect(decide({ state: { signedIn: false } })).toEqual({ type: 'connect' });
	expect(decide({ state: { signedIn: false }, connectDismissed: true })).toEqual({ type: 'idle' });
});

test('recognizes the first form step by URL or heading', () => {
	expect(isFirstFormStep(formUrl, 'about')).toBe(true);
	expect(isFirstFormStep(stepUrl, 'organizationRepresentation')).toBe(true);
	expect(isFirstFormStep(stepUrl, 'purchaseType')).toBe(false);
});
