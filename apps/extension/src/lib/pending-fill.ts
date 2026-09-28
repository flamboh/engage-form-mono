import { type EngageStep, isEngageFormUrl } from '@engage-form/fill-engine';

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
	| { type: 'confirm'; pendingFill: PendingFill }
	| { type: 'start'; pendingFill: PendingFill };

const formStartPath = '/engage/submitter/form/start/';
const firstSteps: EngageStep[] = ['formStart', 'organizationRepresentation'];

export function isFirstFormStep(url: string, step: EngageStep) {
	return new URL(url).pathname.startsWith(formStartPath) || firstSteps.includes(step);
}

export function autoStartDecision(input: {
	url: string;
	step: EngageStep;
	activeRun: boolean;
	state: PendingFillState;
	signInDismissed: boolean;
	confirmDismissed: boolean;
}): AutoStartDecision {
	if (!isEngageFormUrl(input.url) || input.activeRun) return { type: 'idle' };
	if (input.step === 'unknown' || input.step === 'review') return { type: 'idle' };
	if (!input.state.signedIn) return input.signInDismissed ? { type: 'idle' } : { type: 'signIn' };

	const { pendingFill } = input.state;
	if (pendingFill === null) return { type: 'idle' };
	if (isFirstFormStep(input.url, input.step)) return { type: 'start', pendingFill };
	return input.confirmDismissed ? { type: 'idle' } : { type: 'confirm', pendingFill };
}
