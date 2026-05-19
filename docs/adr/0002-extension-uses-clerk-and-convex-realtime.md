# WXT Extension Uses Clerk and Convex Realtime

The browser extension is implemented as a WXT extension with a Svelte popup. It signs in with the same Clerk identity as the web app and uses authenticated Convex queries and mutations instead of custom device tokens. OAuth sign-in happens in the web app, then the extension reads the synced Clerk session with Clerk Sync Host.

Ready purchase requests are observed through Convex realtime in the popup while it is open. The popup owns the realtime `listReadyPurchases` query and asks background code for fresh Convex tokens when its client needs auth.

Background code is the extension's Clerk token authority and direct-operation host. It uses EffectTS for backend-facing orchestration: Clerk token reads, Convex HTTP calls, active fill-run state, and document blob caching. Content scripts stay focused on Engage DOM interaction.

## Consequences

- Extension functions derive ownership from Clerk identity with the same `authedQuery` and `authedMutation` pattern as the web app.
- OAuth, SAML, and email-link auth must be initiated in the browser-hosted web app; the popup only exposes auth methods supported inside extension popups.
- Clerk must allow the extension origin (`chrome-extension://<extension-id>`) and the manifest must include the Clerk Sync Host in `host_permissions`.
- Background code is the extension's Clerk token authority; the popup asks background for Convex tokens when its realtime client needs auth.
- The extension stores auth/session state and active fill-run ids, not ready purchase request facts or document payloads as durable sync state.
- The popup has no manual refresh or selected cached card; Convex updates drive the ready list.
- Manifest V3 background code should not be treated as a long-lived realtime host; use realtime in the popup and direct authenticated calls for background/content-script requests.
- Extension runtime messages use operation names rather than Engage-prefixed names: `AUTH_STATE`, `GET_CONVEX_TOKEN`, `SIGN_OUT`, `START_FILL`, `GET_FILL_PAYLOAD`, `REVIEW_REACHED`, and `FILL_RUN_ENDED`.
- `GET_FILL_PAYLOAD` means "fetch the assembled Ready purchase request payload for this fill run step." Content scripts may request it on each Engage page; background re-fetches the Ready payload and caches document blobs in memory for the active fill run.
- `apps/ext-wxt` can exist as a temporary migration package until it reaches parity with `apps/extension`; the existing extension remains the working reference during migration.
