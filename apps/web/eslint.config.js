import prettier from 'eslint-config-prettier';
import path from 'node:path';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');
const workspaceRoot = path.resolve(import.meta.dirname, '../..');

export default defineConfig(
	{
		ignores: [
			'**/node_modules/**',
			'**/dist/**',
			'**/dist-ssr/**',
			'**/build/**',
			'**/.svelte-kit/**',
			'**/.vercel/**',
			'convex/_generated/**',
			'.agents/**'
		]
	},
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off',
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
			'svelte/no-navigation-without-resolve': 'off'
		}
	},
	{
		files: ['convex/**/*.ts', 'apps/extension/**/*.ts', 'packages/**/*.ts'],
		languageOptions: {
			parserOptions: {
				project: [
					path.resolve(workspaceRoot, 'convex/tsconfig.json'),
					path.resolve(workspaceRoot, 'apps/extension/tsconfig.json'),
					path.resolve(workspaceRoot, 'packages/domain/tsconfig.json'),
					path.resolve(workspaceRoot, 'packages/fill-engine/tsconfig.json'),
					path.resolve(workspaceRoot, 'packages/utils/tsconfig.json')
				],
				tsconfigRootDir: workspaceRoot
			}
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig
			}
		}
	}
);
