import tailwindcss from '@tailwindcss/vite';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { defineConfig } from 'wxt';

const workspaceRoot = resolve(import.meta.dirname, '../..');
const extensionRoot = import.meta.dirname;
const engageOrigin = 'https://uoregon.campuslabs.com';
const productionWebAppOrigin = 'https://forms.oli.boo';

export default defineConfig({
	srcDir: 'src',
	manifestVersion: 3,
	modules: ['@wxt-dev/module-svelte'],
	manifest: ({ mode, browser }) => {
		const env = loadBuildEnv(mode, browser);
		const clerkFrontendApi = env.CLERK_FRONTEND_API ?? env.CLERK_FRONTEND_API_URL;
		const allowLocalHosts = mode !== 'prod';

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
				...new Set(
					[
						'https://*.convex.cloud/*',
						'https://*.convex.site/*',
						hostPermission(engageOrigin),
						hostPermission(productionWebAppOrigin),
						'http://localhost/*',
						'http://127.0.0.1/*',
						hostPermission(env.PUBLIC_WEB_APP_URL ?? 'http://localhost'),
						hostPermission(
							env.PUBLIC_CLERK_SYNC_HOST ?? env.PUBLIC_WEB_APP_URL ?? 'http://localhost'
						),
						clerkFrontendApi ? hostPermission(clerkFrontendApi) : null
					].filter(
						(value): value is string =>
							value !== null && (allowLocalHosts || !isLocalHostPermission(value))
					)
				)
			],
			content_security_policy:
				mode === 'development'
					? {
							extension_pages:
								"script-src 'self' 'wasm-unsafe-eval' http://localhost:*; object-src 'self';",
							sandbox:
								"script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:*; sandbox allow-scripts allow-forms allow-popups allow-modals; child-src 'self';"
						}
					: undefined
		};
	},
	vite: ({ mode, browser }) => ({
		envDir: workspaceRoot,
		envPrefix: ['VITE_', 'PUBLIC_'],
		define: publicEnvDefines(loadBuildEnv(mode, browser)),
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
	[key: string]: string | undefined;
};

function publicEnvDefines(env: BuildEnv) {
	return Object.fromEntries(
		Object.entries(env)
			.filter(
				(entry): entry is [string, string] =>
					entry[0].startsWith('PUBLIC_') && typeof entry[1] === 'string'
			)
			.map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)])
	);
}

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

function isLocalHostPermission(permission: string) {
	const hostname = new URL(permission.replace(/\*$/, '')).hostname;
	return hostname === 'localhost' || hostname === '127.0.0.1';
}

function hostPermission(value: string) {
	const trimmed = value.trim().replace(/\/$/, '');
	if (!trimmed) return null;
	return `${new URL(trimmed).origin}/*`;
}
