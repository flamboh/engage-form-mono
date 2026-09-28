import { expect, test } from 'vitest';
import { autoStartDecision, isPendingFillFresh, pendingFillMaxAgeMs } from './pending-fill';

const formUrl = 'https://uoregon.campuslabs.com/engage/submitter/form/start/730239';
const now = 1_800_000_000_000;
const pendingFill = {
	purchaseRequestId: 'purchase_1',
	requestedAt: now - 5_000,
	label: 'Costco · $45.98',
	engageUrl: formUrl
};

function decide(overrides: Partial<Parameters<typeof autoStartDecision>[0]> = {}) {
	return autoStartDecision({
		url: formUrl,
		step: 'formStart',
		now,
		activeRun: false,
		state: { signedIn: true, pendingFill },
		signInDismissed: false,
		...overrides
	});
}

test('starts a fresh pending fill on an Engage form page', () => {
	expect(decide()).toEqual({ type: 'start', pendingFill });
});

test('ignores pages outside the Engage submitter form', () => {
	expect(decide({ url: 'https://uoregon.campuslabs.com/engage/organizations' })).toEqual({
		type: 'idle'
	});
});

test('waits for a recognized purchase request step and never starts on review', () => {
	expect(decide({ step: 'unknown' })).toEqual({ type: 'idle' });
	expect(decide({ step: 'review' })).toEqual({ type: 'idle' });
	expect(decide({ step: 'about' })).toEqual({ type: 'start', pendingFill });
});

test('lets an active fill run resume instead of starting again', () => {
	expect(decide({ activeRun: true })).toEqual({ type: 'idle' });
});

test('stays idle without a pending fill', () => {
	expect(decide({ state: { signedIn: true, pendingFill: null } })).toEqual({ type: 'idle' });
});

test('asks to sign in when the extension has no session', () => {
	expect(decide({ state: { signedIn: false } })).toEqual({ type: 'signIn' });
	expect(decide({ state: { signedIn: false }, signInDismissed: true })).toEqual({ type: 'idle' });
});

test('expires pending fills older than thirty minutes', () => {
	const stale = { ...pendingFill, requestedAt: now - pendingFillMaxAgeMs - 1 };
	expect(decide({ state: { signedIn: true, pendingFill: stale } })).toEqual({
		type: 'expire',
		pendingFill: stale
	});
});

test('treats small clock skew as fresh', () => {
	expect(isPendingFillFresh({ requestedAt: now + 30_000 }, now)).toBe(true);
	expect(isPendingFillFresh({ requestedAt: now + 5 * 60_000 }, now)).toBe(false);
	expect(isPendingFillFresh({ requestedAt: now - pendingFillMaxAgeMs }, now)).toBe(true);
});
