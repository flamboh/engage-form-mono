# Purchase Builder MVP

## Product Shape

The web app is the canonical purchase builder. Engage is an implementation detail.

Users complete one simpler, authenticated form for the supported event prize reimbursement flow. The extension syncs with Convex, lists recent ready or filled purchases, and fills Engage from the selected purchase. The extension never submits the final Engage form.

## Scope

First supported template:

- Personal reimbursement for an event prize/gift
- ASUO funds
- Merchandise/apparel/gifts documentation path
- One or more recipients
- Up to three receipts
- Event publicity proof
- Second approval only when requester is also purchaser

Out of scope:

- Multiple RTP templates
- Organization sharing
- Reusable non-ID request files
- Purchaser permission uploads
- Manual Engage-facing assumptions in the builder UI
- Extension submission

## App Routes

- `/app`: dashboard with recent purchase requests and start-new action
- `/app/purchase/new`: single long-page purchase builder
- `/app/saved`: one page for saved organizations, people, and event presets

The builder may create saved records inline. Saved records can also be managed from `/app/saved`.

## Saved Records

All saved records are personal-owned for MVP.

Organizations:

- Name
- Index number
- Fund letter
- Default budget line item
- Business purpose template
- Archived flag

People:

- Nested under one organization
- Name
- UO 95
- Permanent address
- ID front file
- ID back file
- Optional email
- Optional phone
- `isRequester`
- Archived flag

People require ID front/back at creation. Email and phone are required only when marking a person as requester. An organization may have zero requester people, but a purchase cannot be marked ready until its organization has one requester.

At most one active requester is allowed per organization. Setting one person as requester unsets the previous requester for that organization.

Event presets:

- Nested under one organization
- Name
- Time
- Location
- Estimated attendance
- Archived flag

Saved organizations, people, and event presets are archived instead of deleted. Archived records are hidden by default, recoverable with a "Show archived" toggle, and unavailable for new purchases.

## Purchase Requests

Purchases use live references for organization, requester person, purchaser person, and event preset.

Request fields:

- Organization
- Purchaser, defaulting to the requester
- Event preset
- Event date
- Vendor
- Item description
- Total amount
- Budget line item
- Reimbursement reason
- Business purpose text
- `businessPurposeTouched`
- Recipients
- Receipts, up to three
- Second approval file
- Publicity proof file
- Status: `draft`, `ready`, `filled`
- `lastFilledAt`

Drafts are created immediately and autosaved through Convex debounced mutations. Discarding a draft hard deletes the draft and synchronously deletes purchase-local uploaded files. Saved person ID files are not deleted by draft discard.

## Business Purpose

Business purpose is explicit text, initialized from the organization's template.

Supported template tokens:

- `{org}`
- `{requester}`
- `{purchaser}`
- `{vendor}`
- `{item}`
- `{amount}`
- `{recipient}`
- `{recipientUo95}`
- `{recipientReason}`
- `{eventName}`
- `{eventDate}`
- `{eventTime}`
- `{eventLocation}`
- `{attendance}`

Business purpose regenerates while `businessPurposeTouched` is false. Once the user edits it, the text is preserved. A regenerate action resets from the current template and variables.

Missing variables remain visible as token text. Unresolved tokens block ready status.

## Recipients

Recipients are multi-row via an add button.

Each recipient has:

- Name
- UO 95
- Reason
- Value

The item description is global for the purchase. Recipient values should sum to the purchase total, and each recipient value must be under `$50`.

## Files

MVP accepts any file type and records filename, content type, size, and Convex storage ID.

Reusable files:

- Person ID front
- Person ID back

Purchase-local files:

- Receipts, up to three
- Second approval
- Publicity proof

Second approval is required only when selected purchaser is the requester.

## Readiness

Ready status is blocked unless all required data exists:

- Organization selected
- Organization has requester
- Purchaser selected
- Event preset selected
- Event date
- Vendor
- Item description
- Total amount greater than zero
- Budget line item
- Reimbursement reason
- Business purpose text
- No unresolved business purpose tokens
- At least one recipient
- Recipient name, UO 95, reason, and value
- Each recipient value under `$50`
- Recipient values sum to purchase total
- Purchaser ID front/back
- Receipt upload
- Publicity proof upload
- Second approval when purchaser is requester

## Extension

The extension talks to Convex directly through a long-lived device link token created by the authenticated web app.

Token capabilities:

- List recent ready and filled purchase requests
- Fetch one assembled purchase payload
- Mark a purchase filled when Engage review is reached

Token cannot create, update, delete, or archive saved records.

The extension popup lists recent ready and filled purchases with organization, purchaser, and item purchased. Filled rows are greyed but still selectable. Re-filling a filled purchase keeps status `filled` and updates `lastFilledAt`.

The extension fetches file blobs in extension context before sending prepared file payloads to the content script. The content script stays focused on Engage DOM interaction.

## Engage Mapping

The builder hides Engage page structure. Fill logic maps the simplified purchase model to the existing Engage RTP fill plan.

Requester fields fill Engage requestor fields. Purchaser fields fill reimbursement recipient fields, address, and ID uploads.

The extension stops at Engage review and never clicks submit.
