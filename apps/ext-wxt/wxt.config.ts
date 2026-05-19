import tailwindcss from '@tailwindcss/vite';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { defineConfig } from 'wxt';

const workspaceRoot = resolve(import.meta.dirname, '../..');
const extensionRoot = import.meta.dirname;
const engageOrigin = 'https://uoregon.campuslabs.com';

export default defineConfig({
	srcDir: 'src',
	manifestVersion: 3,
	modules: ['@wxt-dev/module-svelte'],
	manifest: ({ mode, browser }) => {
		const env = loadBuildEnv(mode, browser);
		const clerkFrontendApi = env.CLERK_FRONTEND_API ?? env.CLERK_FRONTEND_API_URL;

		return {
			name: 'Engage Form',
			version: '0.0.1',
			description: 'Fill Engage purchase request forms from prepared purchase requests.',
			key: env.CRX_PUBLIC_KEY?.trim() || undefined,
			action: {
				default_title: 'Engage Form'
			},
			permissions: ['activeTab', 'cookies', 'scripting', 'storage'],
			host_permissions: [
				'https://*.convex.cloud/*',
				'https://*.convex.site/*',
				hostPermission(engageOrigin),
				hostPermission(env.PUBLIC_CLERK_SYNC_HOST ?? env.PUBLIC_WEB_APP_URL ?? 'http://localhost'),
				clerkFrontendApi ? hostPermission(clerkFrontendApi) : null
			].filter((value): value is string => value !== null)
		};
	},
	vite: () => ({
		envDir: workspaceRoot,
		envPrefix: ['VITE_', 'PUBLIC_'],
		plugins: [tailwindcss()],
		resolve: {
			alias: {
				'@clerk/ui/no-rhc': resolve(extensionRoot, 'src/lib/clerk-ui-background-stub.ts')
			}
		}
	})
});

type BuildEnv = {
	CLERK_FRONTEND_API?: string;
	CLERK_FRONTEND_API_URL?: string;
	CRX_PUBLIC_KEY?: string;
	PUBLIC_CLERK_SYNC_HOST?: string;
	PUBLIC_WEB_APP_URL?: string;
};

function loadBuildEnv(mode: string, browser: string): BuildEnv {
	return {
		...loadEnvFiles(workspaceRoot, mode, browser),
		...loadEnvFiles(extensionRoot, mode, browser),
		...process.env
	} as BuildEnv;
}

function loadEnvFiles(root: string, mode: string, browser: string): Record<string, string> {
	return [
		'.env',
		'.env.local',
		`.env.${mode}`,
		`.env.${mode}.local`,
		`.env.${browser}`,
		`.env.${browser}.local`,
		`.env.${mode}.${browser}`,
		`.env.${mode}.${browser}.local`
	].reduce<Record<string, string>>((env, filename) => {
		const path = resolve(root, filename);
		if (!existsSync(path)) return env;
		return { ...env, ...(parseEnv(readFileSync(path, 'utf8')) as Record<string, string>) };
	}, {});
}

function hostPermission(value: string) {
	const trimmed = value.trim().replace(/\/$/, '');
	if (!trimmed) return null;
	return `${new URL(trimmed).origin}/*`;
}
