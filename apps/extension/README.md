# Engage Form WXT Extension

Canonical Engage Form browser extension package.

## Commands

- `bun run dev`
- `bun run build` (dev env from the repo-root `.env.local`, output `.output/chrome-mv3`)
- `bun run build:prod` (public prod env from `.env.prod`, output `.output/chrome-mv3-prod`)
- `bun run zip:prod`
- `bun run check`
- `bun run test`

## Loading in Chrome

Open `chrome://extensions`, turn on Developer mode, choose **Load unpacked**, and pick the
build output folder (or the unzipped `zip:prod` archive). `CRX_PUBLIC_KEY` in `.env.chrome`
keeps the extension ID stable at `obfjadbmonppinfhbcciiemmcbaioocn`.

## Fill flow

**Fill on Engage** in the web app calls `api.authed.extension.requestFill`, which marks a Draft
purchase request Ready (Approved requests are refused), stores `users.pendingFill`, and returns
the Engage form URL. On the first step of a new Engage purchase request form, the content script
claims the pending fill with `claimPendingFill` (the server returns it only if it is under 30
minutes old and clears it, so only one tab fills) and starts the fill run. On later steps it asks
first ("Fill this form with …?"). The run stops on Review Submission, where `markReviewReached`
records the fill. The popup lists Ready requests as a fallback and shows the pending fill; it
can't start a run while another is filling the page.

Localhost host permissions are only included in non-`prod` builds.
