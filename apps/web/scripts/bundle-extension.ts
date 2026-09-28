import { copyFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const appRoot = path.resolve(import.meta.dirname, '..');
const extensionRoot = path.resolve(appRoot, '../extension');
const outputDir = path.join(extensionRoot, '.output');
const target = path.join(appRoot, 'static/engage-form-extension.zip');

const build = Bun.spawnSync(['bun', 'run', 'zip:prod'], {
	cwd: extensionRoot,
	stdout: 'inherit',
	stderr: 'inherit'
});
if (build.exitCode !== 0) process.exit(build.exitCode ?? 1);

const zips = readdirSync(outputDir)
	.filter((name) => name.endsWith('-chrome.zip'))
	.map((name) => path.join(outputDir, name))
	.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
if (zips.length === 0) throw new Error(`No Chrome zip found in ${outputDir}.`);
copyFileSync(zips[0], target);
console.log(`Copied ${path.basename(zips[0])} to ${path.relative(appRoot, target)}`);
