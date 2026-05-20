# Purchase Request Builder MVP

## Product Shape

The web app is the canonical purchase request builder. Engage is an implementation detail.

Users complete one simpler, authenticated form for the supported event prize reimbursement flow. The extension syncs with Convex, lists recent ready purchase requests, and fills Engage from the selected purchase request. The extension never submits the final Engage form.

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

- Multiple Engage form templates
- Student Organization sharing
- Reusable non-ID request documents
- Purchaser permission uploads
- Manual Engage-facing assumptions in the builder UI
- Extension submission

## App Routes

- `/app`: dashboard with recent purchase requests and start-new action
- `/app/purchase/new`: single long-page purchase builder
- `/app/saved`: one page for student organizations, purchasers, and Business Purpose Templates

The builder may create autofill sources inline. Autofill sources can also be managed from `/app/saved`.

## Autofill Sources

All autofill sources are personal-owned for MVP.

Student Organizations:

- Name
- Index number
- Fund letter
- Budget Line Items
- Business purpose template
- Archived flag

Purchasers:

- Nested under one student organization
- Name
- UO 95
- Permanent address
- ID card document or documents
- Archived flag

Purchasers require ID card documentation at creation.

Business Purpose Templates:

- Nested under one student organization
- Title
- Business Purpose template
- Archived flag

Student organizations, purchasers, and Business Purpose Templates are archived instead of deleted. Archived records are hidden by default, recoverable with a "Show archived" toggle, and unavailable for new purchase requests.

## Purchase Requests

Purchase requests record the facts needed for Engage. Student organization, purchaser, requester, and Business Purpose Template data only autofill drafts.

Request fields:

- Student Organization
- Requester
- Purchaser, defaulting to the requester
- Event name
- Event date
- Event time
- Event location
- Estimated attendance
- Vendor
- Item description
- Total amount
- Budget Line Item
- Reimbursement reason
- Business purpose text
- `businessPurposeTouched`
- Recipients
- Receipt documents, up to three
- Second Approval document
- Publicity Proof document
- Status: `draft`, `ready`
- `lastFilledAt`

Drafts are created immediately and autosaved through Convex debounced mutations. Discarding a draft hard deletes the draft and synchronously deletes purchase-request-local uploaded documents. Saved purchaser ID card documents are not deleted by draft discard.

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

## Documents

MVP accepts any document type and records filename, content type, size, and Convex storage ID.

Reusable documents:

- Purchaser ID card document or documents

Purchase-request-local documents:

- Receipts, up to three
- Second approval
- Publicity proof

Second approval is required only when selected purchaser is the requester.

## Readiness

Ready status is blocked unless all required data exists:

- Student Organization selected
- Requester recorded
- Purchaser selected
- Event name
- Event date
- Event time
- Event location
- Estimated attendance greater than zero
- Vendor
- Item description
- Total amount greater than zero
- Budget Line Item
- Reimbursement reason
- Business purpose text
- No unresolved business purpose tokens
- At least one recipient
- Recipient name, UO 95, reason, and value
- Each recipient value under `$50`
- Recipient values sum to purchase total
- Purchaser ID card document or documents
- Receipt document
- Publicity Proof document
- Second approval when purchaser is requester

## Extension

The extension signs in with Clerk and talks to Convex with the same authenticated owner model as the web app.

Extension capabilities:

- List recent ready purchase requests through Convex realtime while the popup is open
- Fetch one assembled purchase payload by id for each fill step
- Record when Engage review is reached

The extension cannot create, update, delete, or archive autofill sources.

The extension popup lists recent ready purchase requests with Student Organization, purchaser, and item purchased. Rows that have reached Engage review before are still selectable and show that history through `lastFilledAt`.

The extension background fetches document blobs in extension context and caches them in memory for the active fill run. The content script stays focused on Engage DOM interaction.

## Engage Mapping

The builder hides Engage page structure. Fill logic maps the Purchase Request model to the existing Engage fill plan.

Requester fields fill Engage requestor fields. Purchaser fields fill reimbursement recipient fields, address, and ID uploads.

The extension stops at Engage review and never clicks submit.
