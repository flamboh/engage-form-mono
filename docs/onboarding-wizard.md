# Onboarding Wizard

A guided first-run flow that replaces the empty `/app` dashboard. New users complete a hard-gated wizard before reaching the main app, so every authenticated session that lands in the builder already has a complete requester profile, at least one Student Organization, and a linked extension.

## Goals

- Eliminate the "empty dashboard, figure it out" cliff for first-time users.
- Capture the requester identity once at the user level so the builder never has to ask "who is requesting?"
- Make the extension link step part of onboarding instead of a side-panel afterthought.
- Establish a clear "build your first request" CTA at the end.

## Non-goals

- Mobile-friendly ID upload (QR-to-phone is deferred polish).
- Multi-tenant Student Organization sharing or invitations.
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
- `idCardFrontFileId: Id<"files"> | null`
- `idCardBackFileId: Id<"files"> | null`
- `updatedAt: number`

Text fields are required at creation. ID photos are added when a request first needs them, or from Settings > You. Index on `clerkUserId`.

### Student Organizations

- Drop `defaultBudgetLineItem`.
- Add `budgetLines: { name: string; allocations: { fiscalYear: number; amount: number }[] }[]` (ordered; allocations are optional per fiscal year).
- Keep `name`, `indexNumber`, `fundLetter`, `archived`, `owner`, `updatedAt`.

### Purchasers

Renamed and narrowed. Purchasers are _other people_ who paid for something. The requester is always the current user, so the requester role no longer lives in this table.

- Drop `isRequester`, `email`, `phone`.
- Keep `name`, `uo95`, `permanentAddress`, `idCardFrontFileId`, `idCardBackFileId`, `archived`, `organizationId`, `owner`, `updatedAt`.
- Drop the `by_owner_and_organizationId_and_isRequester` index.

### Purchase Requests

- Replace the old purchaser-person reference with:
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

1. `profile` — Create `users` row. Fields above, without ID photos. No skip.
2. `org` — Create first student organization with `budgetLines` as a repeatable list of names. No skip.
3. `event` — Save a recurring Event. Skippable.
4. `extension` — Install and connect the extension, then land on the Student Organization board.

### Gating

`/app/*` layout guard runs on every navigation:

1. No `users` row → redirect to `/app/welcome/profile`.
2. No `organizations` rows → redirect to `/app/welcome/org`.
3. Otherwise allow through.

The extension signs in directly with Clerk and never gates onboarding. The `done` step is informational; once gates 1–2 pass, `/app` becomes reachable.

A user who bails mid-wizard and returns later lands on the first incomplete step automatically.

### Trigger

Triggered by the layout guard above, not by a sign-in event. This means the wizard re-enters automatically if any required row is missing for any reason (admin deletion, etc.).

## Post-wizard Surface Changes

### Dashboard (`/app`)

- Remove the "Extension link" side panel.
- The account menu links to Settings and to `/app/settings#extension`, with a live connection dot.

### Settings (`/app/settings`)

- `#you`: the current `users` row, including both ID photos.
- `#org-{id}`: organization details, budget lines with allocations, Events, purchasers and approvers.
- `#extension`: explains that the extension connects with a session token from the web app. The extension's Connect banner opens `/app/settings?connect=1#extension`.
- `#account`: sign-in email, Manage sign-in and Sign out.
- No requester-related UI (no `isRequester` toggle, no email/phone fields on the purchaser form).

### Request page (`/app/org/[organizationId]/purchase/[purchaseRequestId]`)

- Remove the requester-person picker entirely.
- Purchaser section shows a toggle: **I'm the purchaser** (default, `kind: "self"`) / **Someone else** (reveals purchaser picker, `kind: "purchaser"`).
- When `kind: "self"`, the builder reads requester ID card documents, name, address, etc. from the current `users` row instead of a purchaser record.
- The generated Business Purpose names the purchaser from `users` when `kind: "self"`.

### Engage fill mapping

- Requester-side Engage fields fill from `users`.
- Purchaser-side Engage fields fill from `users` when `kind: "self"`, or from the selected `purchasers` row otherwise.
- Second approval upload appears only when `kind: "self"`, matching existing logic.

## Build Order

1. Schema rewrite: add `users`, change Student Organization fields, add `purchasers`, update `purchaseRequests.purchaser` shape. Delete now-invalid backend code.
2. Backend mutations: `upsertUserProfile`, `createOrganization` (with `budgetLines`), `createPurchaser`, `createEventPreset`.
3. `/app/welcome/[step]` routes and the `/app/*` layout guard.
4. Extension section in `/app/settings`.
5. Builder updates: drop requester picker, add purchaser-self toggle, retarget token resolution to `users`.
6. Settings page: profile, organizations, extension and account sections.
7. Dashboard cleanup: remove side panel, add the account menu.
8. Engage fill updates: rewire requester source to `users`.

## Open Questions

- None blocking. Layout/visual design of each wizard step (copy, illustration, progress indicator) to be decided during implementation.
