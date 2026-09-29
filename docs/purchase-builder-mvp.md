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

- `/app`: Student Organization picker
- `/app/org/[organizationId]`: board with the organization's purchase requests and receipt drop to start a new one
- `/app/org/[organizationId]/purchase/[purchaseRequestId]`: purchase request page
- `/app/org/[organizationId]/budget`: allocations, spending per budget line, and the purchases ledger
- `/app/settings`: one page for your profile (`#you`), each student organization with its purchasers, Events and approvers (`#org-{id}`), the extension (`#extension`), and sign-in (`#account`)

The request page may create autofill sources inline. Autofill sources can also be managed from `/app/settings`.

## Autofill Sources

All autofill sources are personal-owned for MVP.

Student Organizations:

- Name
- Index number
- Fund letter
- Budget Line Items
- Archived flag

Purchasers:

- Nested under one student organization
- Name
- UO 95
- Permanent address
- ID card document or documents
- Archived flag

Purchasers require ID card documentation at creation.

Events:

- Nested under one student organization
- Name, such as "Weekly listening event"
- Usual weekday, or none for a one-off event
- Start time
- Location
- Typical attendance
- Open to all students, defaulting to yes
- Last used time, for ordering
- Archived flag

Choosing an Event on a request copies its facts into the request. Edits on the request do not change the saved Event unless the user saves them back.

Student organizations, purchasers, and Events are archived instead of deleted. Archived records are hidden by default, recoverable with a "Show archived" toggle, and unavailable for new purchase requests.

## Purchase Requests

Purchase requests record the facts needed for Engage. Student organization, purchaser, requester, and Event data only autofill drafts. A new draft copies the previous request's event facts, but not its dates.

Request fields:

- Student Organization
- Requester
- Purchaser, defaulting to the requester
- Activity: the Event it came from, event name, one or more dates, time, location, attendance, and whether it was open to all students
- Purpose
- Vendor
- Item description
- Total amount
- Budget Line Item
- Reimbursement reason
- Business purpose override, when the user customized the text
- Recipients
- Receipt documents, up to three
- Second Approval document
- Publicity Proof document
- Status: `draft`, `ready`
- `lastFilledAt`

Drafts are created immediately and autosaved by sending the latest snapshot with the list of changed fields. The server applies only the changed fields. Discarding a draft hard deletes the draft and its purchase-request-local uploaded documents. Saved purchaser ID card documents are not deleted by draft discard.

## Business Purpose

The Business Purpose is generated from the request's facts by `generateBusinessPurpose` in `convex/businessPurpose.ts`. It follows the style of approved requests in two sentences:

```txt
{Org} wishes to reimburse {Purchaser} because they purchased {items} from {vendor} for {total}. The {items} were given to {Recipient} ({95#}) for {reason} at {Org}'s {event} on Tuesday 05/19 at 6:30pm in McKenzie 240A, with about 50 students in attendance.
```

- The purchase is always past tense. The use clause follows the event dates: past when they have passed, future when all are ahead, present when the dates span today.
- Weekdays are computed from dates, never stored. Several dates on one weekday read "Tuesdays (05/12, 05/19, 05/26)"; five or more weekly dates read "every Tuesday from 03/31 through 06/02".
- Recipients are listed with their 95# and reason. Without recipients, "what was it for" is woven in as the use.
- A missing fact is left out of the sentence rather than leaving a blank, and is reported by name with a plain label such as "Add how many students attended".

The user can replace the text with "Customize". Readiness still checks the facts while the text is customized.

## Recipients

Recipients are multi-row via an add button.

Each recipient has:

- Name
- UO 95
- Reason
- Value

The item description is global for the purchase. Recipient values should sum to the purchase total, and each recipient value must be under `$50`.

## Documents

MVP accepts any document type and records filename, content type, size, and R2 key.

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
- Vendor
- Item description
- Total amount greater than zero
- Budget Line Item
- Reimbursement reason
- Event name, at least one date, time, location, and attendance
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

The web app hides Engage page structure. Fill logic maps the Purchase Request model to the existing Engage fill plan.

Requester fields fill Engage requestor fields. Purchaser fields fill reimbursement recipient fields, address, and ID uploads.

The extension stops at Engage review and never clicks submit.
