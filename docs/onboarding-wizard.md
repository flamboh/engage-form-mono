# Onboarding Wizard

A guided first-run flow that replaces the empty `/app` dashboard. New users complete a hard-gated wizard before reaching the main app, so every authenticated session that lands in the builder already has a complete user profile, at least one org, and a linked extension.

## Goals

- Eliminate the "empty dashboard, figure it out" cliff for first-time users.
- Capture the requester identity once at the user level so the builder never has to ask "who is requesting?"
- Make the extension link step part of onboarding instead of a side-panel afterthought.
- Establish a clear "build your first request" CTA at the end.

## Non-goals

- Mobile-friendly ID upload (QR-to-phone is deferred polish).
- Multi-tenant org sharing or invitations.
- Onboarding for returning users on new devices beyond the extension step.

## Data Model Changes

The app is pre-launch; schema changes are destructive and require no migration.

### New: `users`

One row per Clerk user. Existence of this row is the wizard's profile-step gate.

- `clerkUserId: string`
- `name: string`
- `uo95: string`
- `permanentAddress: string`
- `studentEmail: string` — separate from Clerk auth email; users may OAuth with Google but submit forms under a UO student address.
- `phone: string`
- `idCardFrontFileId: Id<"files">`
- `idCardBackFileId: Id<"files">`
- `updatedAt: number`

All fields required at creation. Index on `clerkUserId`.

### `organizations`

- Drop `defaultBudgetLineItem`.
- Add `budgetLines: string[]` (ordered list of label strings).
- Keep `name`, `indexNumber`, `fundLetter`, `businessPurposeTemplate`, `archived`, `owner`, `updatedAt`.

### `people` → `purchasers`

Renamed and narrowed. Purchasers are _other people_ who paid for something. The requester is always the current user, so the requester role no longer lives in this table.

- Drop `isRequester`, `email`, `phone`.
- Keep `name`, `uo95`, `permanentAddress`, `idCardFrontFileId`, `idCardBackFileId`, `archived`, `organizationId`, `owner`, `updatedAt`.
- Drop the `by_owner_and_organizationId_and_isRequester` index.

### `purchaseRequests`

- Replace `purchaserPersonId: Id<"people"> | null` with:
  ```ts
  purchaser:
    | { kind: "self" }
    | { kind: "purchaser"; purchaserId: Id<"purchasers"> }
    | null
  ```
- Default for new drafts: `{ kind: "self" }`.
- No requester reference; readiness and Engage-fill code read the current user's `users` row.

### Readiness rule changes

- Remove "organization has requester" — implicitly satisfied by the wizard gate.
- "Second approval required" becomes: `purchaser?.kind === "self"`.
- All other readiness rules unchanged.

## Wizard Flow

Route: `/app/welcome/[step]`. Steps in order:

1. `profile` — Create `users` row. Fields above. ID front and back uploaded inline. No skip.
2. `org` — Create first organization with `budgetLines` as a repeatable list of strings. Business purpose template prefilled with a sensible default. No skip.
3. `event` — Optional event preset. "Skip for now" button advances to next step without creating a row.
4. `extension` — Create a device link token, display it, instruct the user to paste it into the Chrome extension. No skip. The token can be created from any device; the user can finish pasting on their laptop later. The step is "complete" once an `extensionSessions` row exists for this owner.
5. `done` — Success screen with the primary CTA: **Build your first request** → `/app/purchase/new`.

### Gating

`/app/*` layout guard runs on every navigation:

1. No `users` row → redirect to `/app/welcome/profile`.
2. No `organizations` rows → redirect to `/app/welcome/org`.
3. No `extensionSessions` rows for owner → redirect to `/app/welcome/extension`.
4. Otherwise allow through.

Event preset is optional and never gates. The `done` step is informational; once gates 1–3 pass, `/app` becomes reachable.

A user who bails mid-wizard and returns later lands on the first incomplete step automatically.

### Trigger

Triggered by the layout guard above, not by a sign-in event. This means the wizard re-enters automatically if any required row is missing for any reason (admin deletion, etc.).

## Post-wizard Surface Changes

### Dashboard (`/app`)

- Remove the "Extension link" side panel — that lives in the wizard now.
- Add an "Extension: linked" status badge near the header, linking to `/app/extension`.
- Split the recent list into **Drafts / Ready** sections (separate from this doc's scope but enabled by the cleaner flow).

### New: `/app/extension`

- Lists existing device tokens with `name`, `createdAt`, `lastUsedAt`.
- "Create new token" action.
- "Revoke" per token.
- This is also where a user who reinstalls the extension goes to re-link.

### Saved (`/app/saved`)

- Rename "People" tab to "Purchasers."
- Remove the requester-related UI (no `isRequester` toggle, no email/phone fields on the form).
- Add a "Profile" entry point that opens an edit view of the current `users` row.

### Builder (`/app/purchase/new`)

- Remove the requester-person picker entirely.
- Purchaser section shows a toggle: **I'm the purchaser** (default, `kind: "self"`) / **Someone else** (reveals purchaser picker, `kind: "purchaser"`).
- When `kind: "self"`, the builder reads requester ID files, name, address, etc. from the current `users` row instead of a person record.
- Business purpose token resolution: `{requester}` now resolves from `users`, not a person row.

### Engage fill mapping

- Requester-side Engage fields fill from `users`.
- Purchaser-side Engage fields fill from `users` when `kind: "self"`, or from the selected `purchasers` row otherwise.
- Second approval upload appears only when `kind: "self"`, matching existing logic.

## Build Order

1. Schema rewrite: add `users`, change `organizations`, rename `people` → `purchasers`, update `purchaseRequests.purchaser` shape. Delete now-invalid backend code.
2. Backend mutations: `upsertUserProfile`, `createOrganization` (with `budgetLines`), `createPurchaser`, `createEventPreset`, `listDeviceTokens`, `revokeDeviceToken`.
3. `/app/welcome/[step]` routes and the `/app/*` layout guard.
4. `/app/extension` page.
5. Builder updates: drop requester picker, add purchaser-self toggle, retarget token resolution to `users`.
6. Saved page updates: rename, drop requester UI, add profile edit entry.
7. Dashboard cleanup: remove side panel, add linked-status badge.
8. Engage fill updates: rewire requester source to `users`.

## Open Questions

- None blocking. Layout/visual design of each wizard step (copy, illustration, progress indicator) to be decided during implementation.
