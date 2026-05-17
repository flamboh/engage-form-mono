export const WELCOME_STEPS = ["profile", "org", "event", "extension", "done"] as const;
export type WelcomeStep = (typeof WELCOME_STEPS)[number];

export type WelcomeState = {
  hasProfile: boolean;
  hasOrganization: boolean;
  hasExtensionLink: boolean;
};

export function firstIncompleteStep(state: WelcomeState): WelcomeStep {
  if (!state.hasProfile) return "profile";
  if (!state.hasOrganization) return "org";
  if (!state.hasExtensionLink) return "extension";
  return "done";
}

export function wizardComplete(state: WelcomeState): boolean {
  return state.hasProfile && state.hasOrganization && state.hasExtensionLink;
}

export const STEP_LABELS: Record<WelcomeStep, string> = {
  profile: "Your profile",
  org: "Your organization",
  event: "Event preset",
  extension: "Chrome extension",
  done: "All set",
};
