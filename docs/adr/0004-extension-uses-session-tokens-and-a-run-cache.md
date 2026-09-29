# Extension Uses Session Tokens and a Run Cache

Supersedes the auth and realtime parts of ADR 0002. The extension no longer uses Clerk or Convex realtime. It holds an extension session token and talks to Convex HTTP actions. Each fill run downloads its purchase request and documents once and fills every later Engage page from that copy.

Clerk JWTs live about a minute and the extension could only get one while a web app tab kept refreshing it or while Clerk Sync Host worked, so fills failed mid-form. A 30-day token that the extension owns removes that dependency, and the run cache means a fill needs the network only at the start and at Review Submission.

## Token flow

- The web app, signed in with Clerk, calls the `connectExtension` action. The server makes 32 random bytes (base64url), stores only the SHA-256 hash in `extensionSessions`, and returns the token once.
- The web app hands the token straight to the extension with `chrome.runtime.sendMessage(extensionId, …)`. The manifest's `externally_connectable` only lists the web app origin, Chrome only delivers to the fixed extension ID, and the extension checks the sender origin. The token never sits in web app storage.
- Any signed-in web app page asks the extension for its status and connects it when it isn't connected, so connecting needs no clicks. When the extension has no valid token, the Engage banner offers "Connect the extension", which opens the web app. The extension picks up the token when the user returns to Engage.
- The extension keeps the token in `browser.storage.local` and sends it as `Authorization: Bearer`. HTTP actions hash it, look it up by index, reject expired or revoked sessions, and pass the owner to internal functions. Expiry slides 30 days forward at most once an hour.
- Disconnecting, from the extension popup or from the web app, revokes the session server-side and removes the local token. After a disconnect the extension stays disconnected until the user connects it again.

## Consequences

- The extension uses no `authed` Convex functions. Its endpoints live in `convex/http.ts` under `/extension/*`, with CORS for the extension origin.
- The extension build needs `PUBLIC_CONVEX_SITE_URL` and `PUBLIC_WEB_APP_URL`, and the manifest lists the Convex site origin in `host_permissions`.
- A run's purchase request and document data URLs live in `browser.storage.session`. Documents too big for its quota go to `browser.storage.local` (`unlimitedStorage`). They are cleared when the run ends, and runs older than six hours are dropped.
- `markReviewReached` goes through an outbox in `browser.storage.local`. It retries with backoff through `alarms` and on every wake-up, and it never blocks the fill.
- The popup loads the ready list through background messages when it opens. It has no realtime subscription.
- Extension runtime messages: `AUTH_STATE`, `CONNECT`, `SIGN_OUT`, `START_FILL`, `PREPARE_FILL_RUN`, `GET_FILL_PAYLOAD`, `GET_FILL_DOCUMENT`, `REVIEW_REACHED`, `FILL_RUN_ENDED`, `GET_PENDING_FILL`, `CLAIM_PENDING_FILL`, `CLEAR_PENDING_FILL`, and `LIST_READY`. External messages from the web app: `STATUS`, `CONNECT`, and `DISCONNECT`.
