# Deploying

The web app is a SvelteKit app on Cloudflare Workers (`@sveltejs/adapter-cloudflare`) served at https://forms.oli.boo. The backend is Convex. Uploaded files live in the R2 bucket `engage-form-files` behind the web Worker.

| Piece       | Where                                                                            |
| ----------- | -------------------------------------------------------------------------------- |
| Web Worker  | `engage-form-web` on Cloudflare, custom domain `forms.oli.boo`                   |
| Convex prod | `rosy-panda-20` (`https://rosy-panda-20.convex.cloud`)                           |
| Convex dev  | `blessed-goat-539`                                                               |
| Files       | R2 bucket `engage-form-files`, bound to the Worker as `FILES`                    |
| Auth        | Clerk instance `sunny-snipe-60` (dev instance, used by both deployments for now) |

## Deploy

Log in once with `bunx wrangler login` and `bunx convex login`. Then, from the repo root:

```sh
bun run deploy:convex
bun run deploy:web
```

`bun run deploy` runs both, Convex first. Deploy Convex first whenever a change touches functions the web app calls.

- `deploy:convex` runs `bunx convex deploy` and pushes `convex/` to the prod deployment.
- `deploy:web` runs `vite build && wrangler deploy` in `apps/web`. `apps/web/wrangler.jsonc` defines the Worker, the R2 binding, the custom domain, and the public runtime vars.

The web app reads its public config via `$env/dynamic/public`, so the prod values come from the Worker `vars` in `wrangler.jsonc` at runtime, not from `.env.local` at build time. Building on a machine whose `.env.local` points at the dev deployment still produces a Worker that talks to Convex prod.

## Configuration

### Worker `vars` (public, in `apps/web/wrangler.jsonc`)

- `PUBLIC_CONVEX_URL`
- `PUBLIC_CONVEX_SITE_URL`
- `PUBLIC_CLERK_PUBLISHABLE_KEY`

### Worker secrets (`bunx wrangler secret put <NAME>` in `apps/web`)

- `FILES_SIGNING_SECRET`
- `CLERK_SECRET_KEY`

### Convex env (`bunx convex env set <NAME>`; add `--prod` for prod)

- `FILES_SIGNING_SECRET`: must equal the Worker secret.
- `FILES_BASE_URL`: `https://forms.oli.boo` on both dev and prod. Dev files go to the same bucket.
- `CLERK_JWT_ISSUER_DOMAIN`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
- `TYPESAFE_AI_KEY`

To run locally against a local Convex backend (`USE_LOCAL_CONVEX=true`), put `FILES_SIGNING_SECRET` and `FILES_BASE_URL` in the repo-root `.env.local`. The vite plugin forwards them to the local backend.

To set secrets without echoing them, pipe or read them from a file:

```sh
bunx wrangler secret put FILES_SIGNING_SECRET < secret.txt
bunx convex env set --prod --from-file prod.env
```

## How file storage works

Convex owns the file metadata (the `files` table, with `r2Key`). The Worker owns the bytes. Convex has no R2 credentials. Instead, it signs short-lived HMAC tickets with `FILES_SIGNING_SECRET` (`convex/fileSigning.ts`), and the Worker checks them before it touches R2.

- Upload: `authed.purchaseBuilder.createUploadTicket` returns `{ uploadUrl, r2Key }` (10 minute expiry, 15 MB max, content type bound into the ticket). The client sends `PUT uploadUrl` with `Content-Type: application/octet-stream` and an `X-File-Name` header, then calls `authed.purchaseBuilder.saveFile({ r2Key, ... })`. `saveFile` rejects any key outside the caller's `ownerKeyPrefix`.
- Download: `fileDownloadUrl` in `convex/files.ts` signs `GET /api/files/object` URLs that stay valid for 1 to 2 hours. Only images, PDFs, and plain text are served inline. Everything else is served as an `application/octet-stream` attachment.
- Delete: deleting a file record schedules `internal.files.deleteObject`, which sends a signed `DELETE /api/files/object`.

The Worker routes are in `apps/web/src/routes/api/files/`. They allow any origin through CORS, because the signature is the only credential and the Chrome extension fetches file bytes cross-origin.

## Rotating the signing secret

Tickets are only valid for up to about 2 hours, so rotating the secret just breaks in-flight uploads and cached preview URLs until clients refetch.

1. Generate a new value, for example `openssl rand -base64 48`, and save it to a file you don't commit.
2. Set it on the Worker: `bunx wrangler secret put FILES_SIGNING_SECRET < secret.txt`, run in `apps/web`.
3. Set it on both Convex deployments with the same value, using `bunx convex env set --from-file` with and without `--prod`.
4. Delete the local secret file.

## Dogfooding seed

After wiping a deployment, restore your own profile, UO ID photos, and Student Organization instead of redoing onboarding:

```sh
bun run seed        # dev
bun run seed:prod   # prod
```

The script reads `.seed/seed.json` plus the ID images next to it, uploads the images to R2 under the owner's key prefix, and calls the internal `seed:restoreOwner` mutation. `.seed/` is gitignored because it holds personal data. `seed.json` has `owner` (the Clerk token identifier), `profile`, `idCardFront`/`idCardBack` (`kind`, `filename`, `contentType`), and `organizations`. Organizations that already exist by name are skipped. Requires `FILES_BASE_URL` and `FILES_SIGNING_SECRET` in `.env.local`.
