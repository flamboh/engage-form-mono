import path from 'node:path';
import { ownerKeyPrefix, signedFileUrl } from '../convex/fileSigning';

type SeedImage = { kind: 'id_front' | 'id_back'; filename: string; contentType: string };
type Seed = {
	owner: string;
	profile: Record<string, string>;
	idCardFront: SeedImage;
	idCardBack: SeedImage;
	organizations: unknown[];
};

const root = path.resolve(import.meta.dirname, '..');
const seedDir = path.join(root, '.seed');
const prod = process.argv.includes('--prod');
const baseUrl = process.env.FILES_BASE_URL;
const secret = process.env.FILES_SIGNING_SECRET;
if (!baseUrl || !secret)
	throw new Error('Set FILES_BASE_URL and FILES_SIGNING_SECRET in .env.local.');

const seed = (await Bun.file(path.join(seedDir, 'seed.json')).json()) as Seed;
const prefix = await ownerKeyPrefix(seed.owner);

async function upload(image: SeedImage) {
	const bytes = await Bun.file(path.join(seedDir, image.filename)).arrayBuffer();
	const r2Key = `${prefix}/${crypto.randomUUID()}`;
	const url = await signedFileUrl(baseUrl!, secret!, {
		action: 'put',
		key: r2Key,
		expiresAt: Date.now() + 5 * 60 * 1000,
		contentType: image.contentType,
		maxSize: bytes.byteLength
	});
	const response = await fetch(url, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/octet-stream' },
		body: bytes
	});
	if (!response.ok) throw new Error(`Uploading ${image.filename} failed with ${response.status}.`);
	return { ...image, r2Key, size: bytes.byteLength };
}

const args = {
	owner: seed.owner,
	profile: seed.profile,
	idCardFront: await upload(seed.idCardFront),
	idCardBack: await upload(seed.idCardBack),
	organizations: seed.organizations
};

const run = Bun.spawnSync(
	['bunx', 'convex', 'run', ...(prod ? ['--prod'] : []), 'seed:restoreOwner', JSON.stringify(args)],
	{ cwd: root, stdout: 'inherit', stderr: 'inherit' }
);
process.exit(run.exitCode ?? 1);
