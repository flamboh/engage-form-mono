export const WELCOME_STEPS = ['profile', 'org', 'extension'] as const;
export type WelcomeStep = (typeof WELCOME_STEPS)[number];

export type WelcomeState = {
	hasProfile: boolean;
	hasOrganization: boolean;
};

export function firstIncompleteStep(state: WelcomeState): WelcomeStep {
	if (!state.hasProfile) return 'profile';
	if (!state.hasOrganization) return 'org';
	return 'extension';
}

export function wizardComplete(state: WelcomeState): boolean {
	return state.hasProfile && state.hasOrganization;
}

export const STEP_LABELS: Record<WelcomeStep, string> = {
	profile: 'About you',
	org: 'Your organization',
	extension: 'Chrome extension'
};
