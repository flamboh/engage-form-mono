import { env } from "$env/dynamic/public";

type PublicEnvKey = `PUBLIC_${string}`;

const readRequiredPublicEnv = (key: PublicEnvKey) => {
  const value = env[key]?.trim();

  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }

  return value;
};

export const CONVEX_URL = readRequiredPublicEnv("PUBLIC_CONVEX_URL");
export const CONVEX_SITE_URL = readRequiredPublicEnv("PUBLIC_CONVEX_SITE_URL");
