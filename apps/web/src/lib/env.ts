const readOptionalEnv = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const readRequiredEnv = (name: string, value: string | undefined) => {
  const trimmed = readOptionalEnv(value);

  if (!trimmed) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return trimmed;
};

export const appEnv = {
  appName: readOptionalEnv(import.meta.env.VITE_APP_NAME) ?? "Engage Form",
  appDescription:
    readOptionalEnv(import.meta.env.VITE_APP_DESCRIPTION) ??
    "Build purchase requests and fill them into Engage.",
  convexUrl: readRequiredEnv("VITE_CONVEX_URL", import.meta.env.VITE_CONVEX_URL),
  clerkPublishableKey: readRequiredEnv(
    "VITE_CLERK_PUBLISHABLE_KEY",
    import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
  ),
};
