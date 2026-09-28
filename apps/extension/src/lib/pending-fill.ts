import { type EngageStep, isEngageFormUrl } from '@engage-form/fill-engine';

export const pendingFillMaxAgeMs = 30 * 60_000;

export type PendingFill = {
	purchaseRequestId: string;
	requestedAt: number;
	label: string;
	engageUrl: string;
};

export type PendingFillState =
	| { signedIn: false }
	| { signedIn: true; pendingFill: PendingFill | null };

export type AutoStartDecision =
	| { type: 'idle' }
	| { type: 'signIn' }
	| { type: 'expire'; pendingFill: PendingFill }
	| { type: 'start'; pendingFill: PendingFill };

export function autoStartDecision(input: {
	url: string;
	step: EngageStep;
	now: number;
	activeRun: boolean;
	state: PendingFillState;
	signInDismissed: boolean;
}): AutoStartDecision {
	if (!isEngageFormUrl(input.url) || input.activeRun) return { type: 'idle' };
	if (input.step === 'unknown' || input.step === 'review') return { type: 'idle' };
	if (!input.state.signedIn) return input.signInDismissed ? { type: 'idle' } : { type: 'signIn' };

	const { pendingFill } = input.state;
	if (pendingFill === null) return { type: 'idle' };
	if (!isPendingFillFresh(pendingFill, input.now)) return { type: 'expire', pendingFill };
	return { type: 'start', pendingFill };
}

export function isPendingFillFresh(pendingFill: Pick<PendingFill, 'requestedAt'>, now: number) {
	const age = now - pendingFill.requestedAt;
	return age >= -60_000 && age <= pendingFillMaxAgeMs;
}
