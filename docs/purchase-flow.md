# Purchase Request Flow

Reference notes for the first supported Engage purchase request flow.

## MVP Scope

Build a friendlier web app for creating purchase requests, then use the Chrome extension to fill the matching Engage form.

First supported case:

- Type of purchase: Personal Reimbursement
- Fund context: ASUO funds
- Documentation category: gift/apparel/prize
- Example: reimburse a club member for buying a prize for a weekly event
- Extension must stop on the Engage review screen and never click submit

## Product Flow

1. User creates reusable student organization, purchaser, and Business Purpose Template data in the web app.
2. User creates a purchase request from those autofill sources.
3. Web app validates that all required information and documents are present.
4. Purchase request is marked Ready for Engage.
5. User opens the Engage purchase request form.
6. Extension detects the current form step and fills that page from the selected purchase request.
7. User advances through Engage manually or via explicit extension action.
8. Extension stops at the review/submission page.

## Core Records

Student Organization:

- Name
- Index number
- Fund letter
- Budget line items

Purchaser:

- Name
- Email
- Phone
- UO 95 ID
- Permanent address
- ID card document or documents

Business Purpose Template:

- Title
- Business Purpose source text

Purchase Request:

- Student Organization
- Requester
- Purchaser
- Event Details
- Vendor
- Item description
- Total amount
- Budget Line Item
- Reimbursement reason
- Business purpose
- Receipt documents
- Second Approval document when requester is purchaser
- Publicity Proof document
- Recipients

Recipient:

- Name
- UO 95 ID
- Item or prize received
- Value

Document metadata:

- Kind: receipt, id_front, id_back, approval, publicity, brand_approval, recipient_list
- Filename
- Content type
- Size
- Storage key

## Observed Engage Steps

### About You, Your Org, and Business Purpose

Fields:

- Requestor first and last name
- Requestor email
- Requestor phone
- Student organization name
- Student organization index number
- Fund letter checkbox
- Total requested purchase amount
- Budget line item and amount
- Business purpose text

Business purpose must include:

- Vendor name
- Date, time, and location of activity
- Purpose of expenditure
- Cost
- Estimated attendance
- Recipient details when prize/gift

Example pattern:

```txt
{org} wishes to reimburse {purchaser} because they purchased {item} from {vendor} for {amount}. This {item} was given as a gift to {recipientName} ({recipientUo95}) for {reason} during {eventName} on {eventDate} at {eventTime} in {location} with about {attendance} students in attendance.
```

### Mandatory Claims

Required acknowledgements:

- No alcohol or controlled substances
- No raffle or raffle prizes
- Restaurant rule acknowledgement
- Personal reimbursement risk acknowledgement

### Type of Purchase

Supported option for MVP:

- Personal Reimbursement

Other observed options for later:

- Internal PO
- External PO
- PCARD
- Co-Sponsorship Payment
- Service Agreement or Purchase Order for Service

### Personal Reimbursement Purchase Info

Fields:

- Why reimbursement process was used
- Reimbursement recipient selector
- Recipient name and UO 95 ID
- Recipient permanent address
- Mailing/direct deposit acknowledgement
- UO ID card document uploads
- Receipt document uploads

For MVP, assume requester is the reimbursee unless the purchase request says otherwise.

### Seeking Self Reimbursement - Upload Second Approval

Appears when requester and reimbursee are the same person.

Required:

- Upload the Second Approval document
- Approval should include approver name, UO email, total amount, and purchase purpose

### Documentation Inquiry

Observed checkbox options:

- Event is using ASUO funds
- Event is having food
- PO involves printing services
- PO involves designs for merchandise/apparel or gifts
- PO involves purchasing office supplies/goods
- None of the above

MVP checks:

- Event is using ASUO funds
- PO involves designs for merchandise/apparel or gifts

### Event Open To All Students

Required for ASUO funds.

Upload proof that event was promoted at least 7 days in advance.

Accepted proof examples:

- Engage news feed post
- UO Events Calendar post
- Digital display slide
- Poster or print advertisement
- Social media post

### UO Branding/Apparel/Gifts

Rules to validate before marking ready:

- Gift/prize value must be below $50 per recipient per fiscal year
- Gift cards are not allowed
- Cash or cash-equivalent purchases are not allowed
- Recipients must be students or UO affiliates
- Paid raffles are not allowed

Fields:

- Optional UO brand approval upload if non-verified vendor/design needs approval
- Per-person gift/apparel/prize amount
- Recipient name and UO 95 ID
- Optional recipient list upload

### Thank You

Informational page before review.

Notes:

- Request is not final until submit.
- SOFS communicates via Engage comments and email.
- Purchases typically happen after approval.

### Review Submission

Final page before submission.

Contains:

- Section links
- Print link
- Comments box
- Submit button

Extension must stop here.

## Readiness Checklist

A purchase request can be marked Ready when:

- Student Organization name, index, fund letter, and Budget Line Item are present
- Purchaser is complete
- Event date, time, location, attendance are present
- Vendor, item, amount, and reimbursement reason are present
- Receipt document is attached
- ID card documents are attached
- Second Approval document is attached when requester is purchaser
- Publicity Proof is attached for ASUO funds
- Recipient name and UO 95 ID are present
- Gift value is under the policy limit
- Business purpose has been generated and reviewed

## Extension Behavior

- Match pages by visible heading and label text, not volatile respondent page IDs.
- Fill only the currently visible page.
- Require an explicit user action to advance or fill each step.
- Never click Submit.
- Keep fill logic separate from browser APIs so it can be tested with fixtures.
