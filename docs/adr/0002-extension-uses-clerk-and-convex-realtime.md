# Extension Uses Clerk and Convex Realtime

The browser extension signs in with the same Clerk identity as the web app and uses authenticated Convex queries and mutations instead of custom device tokens. OAuth sign-in happens in the web app, then the extension reads the synced Clerk session with Clerk Sync Host. Ready purchase requests are observed through Convex realtime while the popup is open, and fill runs fetch the latest ready purchase request by id instead of caching full purchase request payloads in extension storage.

## Consequences

- Extension functions derive ownership from Clerk identity with the same `authedQuery` and `authedMutation` pattern as the web app.
- OAuth, SAML, and email-link auth must be initiated in the browser-hosted web app; the popup only exposes auth methods supported inside extension popups.
- Clerk must allow the extension origin (`chrome-extension://<extension-id>`) and the manifest must include the Clerk Sync Host in `host_permissions`.
- The extension stores auth/session state and active fill-run ids, not ready purchase request facts or document payloads as durable sync state.
- The popup has no manual refresh or selected cached card; Convex updates drive the ready list.
- Manifest V3 background code should not be treated as a long-lived realtime host; use realtime in the popup and direct authenticated calls for background/content-script requests.
