# Engage Form WXT Extension

Canonical Engage Form browser extension package.

## Commands

- `bun run dev`
- `bun run build` (dev env from the repo-root `.env.local`, output `.output/chrome-mv3`)
- `bun run build:prod` (public prod env from `.env.prod`, output `.output/chrome-mv3-prod`)

Builds need `PUBLIC_CONVEX_SITE_URL` (the `.convex.site` origin) and `PUBLIC_WEB_APP_URL`.

- `bun run zip:prod`
- `bun run check`
- `bun run test`

## Loading in Chrome

Open `chrome://extensions`, turn on Developer mode, choose **Load unpacked**, and pick the
build output folder (or the unzipped `zip:prod` archive). `CRX_PUBLIC_KEY` in `.env.chrome`
keeps the extension ID stable at `obfjadbmonppinfhbcciiemmcbaioocn`.

## Connecting

The extension authenticates with an extension session token, not Clerk. A signed-in Engage Form
page mints one with `api.authed.extensionSessions.connectExtension` and hands it to the extension
through `externally_connectable`. The extension sends it as a bearer token to the Convex HTTP
actions in `convex/http.ts`. See ADR 0004.

## Fill flow

**Fill on Engage** in the web app calls `api.authed.extension.requestFill`, which marks a Draft
purchase request Ready (Approved requests are refused), stores `users.pendingFill`, and returns
the Engage form URL. On the first step of a new Engage purchase request form, the content script
claims the pending fill (`POST /extension/pending-fill/claim`; the server returns it only if it is
under 30 minutes old and clears it, so only one tab fills). The background then downloads the
purchase request and every document once into the run cache, and every later step fills from that
cache without network calls. On later steps it asks first ("Fill this form with …?"). The run stops
on Review Submission, where `POST /extension/review-reached` records the fill through a retrying
outbox. The popup lists Ready requests as a fallback and shows the pending fill. It can't start a
run while another is filling the page.

A missed field lists the labels found on that page, so a changed Engage label shows up in the
error message.

Localhost host permissions are only included in non-`prod` builds.
