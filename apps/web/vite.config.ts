import devtoolsJson from "vite-plugin-devtools-json";
import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import path from "node:path";
import { convexLocal } from "convex-vite-plugin";
import { defineConfig, loadEnv, type PluginOption } from "vite";

const appRoot = import.meta.dirname;
const workspaceRoot = path.resolve(appRoot, "../..");
const convexProjectDir = workspaceRoot;
const convexFunctionsDir = "convex";
const localConvexPort = 3210;
const localConvexSiteProxyPort = 3211;
const localConvexUrl = `http://localhost:${localConvexPort}`;
const localConvexSiteUrl = `http://localhost:${localConvexSiteProxyPort}`;

const getEnvValue = (loadedEnv: Record<string, string>, key: string) =>
  process.env[key] ?? loadedEnv[key];

const LOCAL_CONVEX_ENV_KEYS = [
  "CONVEX_PRIVATE_BRIDGE_KEY",
  "CLERK_SECRET_KEY",
  "CLERK_JWT_ISSUER_DOMAIN",
] as const;

const getLocalConvexEnvVars = (loadedEnv: Record<string, string>) => {
  return Object.fromEntries(
    LOCAL_CONVEX_ENV_KEYS.map((key) => [key, getEnvValue(loadedEnv, key)]).filter(
      ([, value]) => typeof value === "string" && value.length > 0,
    ),
  );
};

const TEMPLATE_ENV_KEYS = [
  "PUBLIC_CONVEX_URL",
  "PUBLIC_CONVEX_SITE_URL",
  "CONVEX_PRIVATE_BRIDGE_KEY",
  "PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "CLERK_JWT_ISSUER_DOMAIN",
] as const;

const copyLoadedEnv = (loadedEnv: Record<string, string>) => {
  for (const key of TEMPLATE_ENV_KEYS) {
    const value = loadedEnv[key];
    if (value && !process.env[key]) process.env[key] = value;
  }
};

export default defineConfig(({ mode }) => {
  const loadedEnv = loadEnv(mode, workspaceRoot, "");
  const useLocalConvex = getEnvValue(loadedEnv, "USE_LOCAL_CONVEX") === "true";
  const resetLocalBackend = getEnvValue(loadedEnv, "RESET_LOCAL_BACKEND") === "true";

  copyLoadedEnv(loadedEnv);

  if (useLocalConvex) {
    process.env.PUBLIC_CONVEX_URL = localConvexUrl;
    process.env.PUBLIC_CONVEX_SITE_URL = localConvexSiteUrl;
  }

  const plugins: PluginOption[] = [tailwindcss(), devtoolsJson(), sveltekit()];

  if (useLocalConvex) {
    plugins.push(
      convexLocal({
        port: localConvexPort,
        siteProxyPort: localConvexSiteProxyPort,
        projectDir: convexProjectDir,
        convexDir: convexFunctionsDir,
        reset: resetLocalBackend,
        envVars: getLocalConvexEnvVars(loadedEnv),
      }),
    );
  }

  return {
    envDir: workspaceRoot,
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(appRoot, "src"),
        $convex: path.resolve(workspaceRoot, "convex"),
      },
    },
    server: {
      allowedHosts: ["olivermac.tail49a5f0.ts.net"],
      fs: {
        allow: [workspaceRoot],
      },
    },
  };
});
