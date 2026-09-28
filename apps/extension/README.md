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

**Fill on Engage** in the web app calls `api.authed.extension.requestFill`, which marks the
purchase request Ready, stores `users.pendingFill`, and returns the Engage form URL. On an
Engage submitter form page, the content script asks background for the pending fill and starts
the fill run when it is less than 30 minutes old. The run stops on Review Submission, where
`markReviewReached` records the fill and clears the pending fill. The popup lists Ready
requests as a fallback and shows the pending fill.
