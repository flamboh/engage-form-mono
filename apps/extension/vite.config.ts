import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';

const workspaceRoot = resolve(import.meta.dirname, '../..');
const extensionRoot = import.meta.dirname;

type ChromeManifest = {
	key?: string;
	host_permissions?: string[];
	[key: string]: unknown;
};

type ChromeBuildEnv = {
	CRX_PUBLIC_KEY?: string;
	CLERK_FRONTEND_API_URL?: string;
	PUBLIC_CLERK_SYNC_HOST?: string;
};

function configureChromeManifest(env: ChromeBuildEnv): Plugin {
	const crxPublicKey = env.CRX_PUBLIC_KEY?.trim();
	const hostPermissions = [
		'https://*.convex.cloud/*',
		'https://*.convex.site/*',
		env.PUBLIC_CLERK_SYNC_HOST ?? 'http://localhost',
		env.CLERK_FRONTEND_API_URL
	]
		.map((value) => (value === undefined ? null : hostPermission(value)))
		.filter((value): value is string => value !== null);
	let manifestPath = resolve(extensionRoot, 'dist/manifest.json');

	return {
		name: 'configure-chrome-manifest',
		configResolved(config) {
			manifestPath = resolve(config.root, config.build.outDir, 'manifest.json');
		},
		closeBundle() {
			if (!existsSync(manifestPath)) return;

			const source = readFileSync(manifestPath, 'utf8');
			const chromeManifest = JSON.parse(source) as ChromeManifest;
			if (crxPublicKey) chromeManifest.key = crxPublicKey;
			chromeManifest.host_permissions = [...new Set(hostPermissions)];
			writeFileSync(manifestPath, `${JSON.stringify(chromeManifest, null, '\t')}\n`);
		}
	};
}

function hostPermission(value: string) {
	const trimmed = value.trim().replace(/\/$/, '');
	if (!trimmed) return null;
	return `${new URL(trimmed).origin}/*`;
}

function loadChromeBuildEnv(mode: string): ChromeBuildEnv {
	return {
		...loadEnv(mode, workspaceRoot, ''),
		...loadEnv('chrome', extensionRoot, '')
	};
}

export default defineConfig(({ mode }) => ({
	envDir: workspaceRoot,
	envPrefix: ['VITE_', 'PUBLIC_'],
	plugins: [configureChromeManifest(loadChromeBuildEnv(mode))],
	build: {
		rollupOptions: {
			input: {
				popup: resolve(import.meta.dirname, 'index.html'),
				background: resolve(import.meta.dirname, 'src/background.ts'),
				content: resolve(import.meta.dirname, 'src/content.ts')
			},
			output: {
				entryFileNames: '[name].js',
				manualChunks(id) {
					if (id.includes('/node_modules/') && id.includes('/convex')) return 'convex';
				}
			}
		}
	}
}));
