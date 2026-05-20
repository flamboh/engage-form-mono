# Engage Form

Engage Form helps University of Oregon students prepare purchase requests for Engage without treating Engage's form structure as the domain model.

## Language

**Requester**:
The signed-in student whose identity details are copied into purchase requests and who submits them through Engage.
_Avoid_: Person, user, submitter

**Purchaser**:
For personal reimbursement, the person who paid and whose reimbursement details may be copied into purchase requests.
_Avoid_: Person, buyer, reimbursee

**Recipient**:
For gift, prize, or apparel requests, the person who receives the item or benefit.
_Avoid_: Winner, attendee, beneficiary

**Purchase Request**:
A prepared request for payment or reimbursement that will be reviewed and submitted through Engage.
_Avoid_: Purchase, request, RTP

**Type of Purchase**:
The Engage category that determines how payment or reimbursement is handled.
_Avoid_: Purchase type, process type

**Documentation Category**:
An Engage checkbox category that determines which documents or follow-up sections a purchase request needs.
_Avoid_: Documentation path, inquiry option

**Personal Reimbursement**:
The type of purchase where a purchaser is paid back after spending personal funds.
_Avoid_: Reimbursement, personal purchase

**Self Reimbursement**:
A personal reimbursement where the requester and purchaser are the same person.
_Avoid_: Requester purchase, self purchase

**Draft**:
A purchase request whose facts or documents are still being prepared.
_Avoid_: Incomplete request

**Ready**:
A purchase request with the required facts and documents to fill into Engage.
_Avoid_: Valid, submitted, filled

**Engage**:
The University of Oregon platform where purchase requests are reviewed and submitted.
_Avoid_: RTP, form backend

**Business Purpose**:
The narrative explanation of why a purchase request benefits the student organization or event.
_Avoid_: Purpose text, reimbursement description

**Reimbursement Reason**:
The explanation for choosing reimbursement instead of another purchasing process.
_Avoid_: Reason, business purpose, justification

**Budget Line Item**:
The student organization funding category charged by a purchase request.
_Avoid_: Budget line, category, account

**Fund Letter**:
The Engage funding code letter for a student organization's money source.
_Avoid_: Fund, fund context

**ASUO Funds**:
The documentation category for events funded by ASUO-administered student organization money.
_Avoid_: ASUO fund context

**Merchandise/Apparel/Gifts**:
The documentation category for requests involving designs for merchandise, apparel, or gifts.
_Avoid_: Gift path, apparel category

**Student Organization**:
The University of Oregon student group whose funding details may be copied into purchase requests.
_Avoid_: Organization, account, workspace

**Business Purpose Template**:
A reusable Business Purpose source scoped to one Student Organization.
_Avoid_: Event preset, recurring event record

**Event Details**:
The event name, date, time, location, and attendance described on a purchase request.
_Avoid_: Event occurrence, event preset

**Document**:
Evidence attached to a purchase request for Engage review.
_Avoid_: File, upload, attachment

**Receipt**:
A document showing what was purchased, from whom, and for what amount.
_Avoid_: Proof of purchase file

**Publicity Proof**:
A document showing that an event was promoted to students before it happened.
_Avoid_: Event promo, advertising file

**Second Approval**:
A document showing another eligible approver approved reimbursement when the requester is also the purchaser.
_Avoid_: Approval file, self approval

**ID Card Document**:
A document showing a purchaser's UO ID card, as either one combined document or separate front and back documents.
_Avoid_: ID card image, ID file, card upload

## Relationships

- A **Student Organization** funds one or more **Purchase Requests**
- A **Student Organization** may provide default details copied into **Draft** purchase requests
- A **Business Purpose Template** may provide a default **Business Purpose**
- A **Purchaser** may provide default details copied into **Draft** personal reimbursement requests
- A **Requester** may provide default details copied into **Draft** purchase requests
- **Business Purpose Templates** may initialize or update **Draft** purchase requests
- **Ready** purchase requests stand on their recorded facts
- A **Requester** owns one or more purchase requests
- A **Purchaser** may be the same person as the **Requester**
- A **Purchaser** may be different from the **Requester**
- A **Purchase Request** belongs to exactly one **Student Organization**
- A **Purchase Request** has exactly one **Type of Purchase**
- A **Purchase Request** may have one or more **Documentation Categories**
- **ASUO Funds** is a **Documentation Category**
- **Merchandise/Apparel/Gifts** is a **Documentation Category**
- A **Purchase Request** has exactly one **Requester**
- A **Purchase Request** may have a **Purchaser** when its **Type of Purchase** is **Personal Reimbursement**
- A **Personal Reimbursement** has exactly one **Purchaser**
- A **Purchase Request** uses exactly one **Fund Letter**
- A **Purchase Request** records its own **Event Details**
- A **Purchase Request** has exactly one **Business Purpose**
- A **Personal Reimbursement** has exactly one **Reimbursement Reason**
- A **Purchase Request** charges exactly one **Budget Line Item**
- A **Purchase Request** may have one or more **Recipients**
- A **Purchase Request** may have one or more **Documents**
- A **Purchase Request** for an event using **ASUO Funds** requires **Publicity Proof**
- A **Purchase Request** with **Merchandise/Apparel/Gifts** may have one or more **Recipients**
- A **Self Reimbursement** requires **Second Approval**
- A **Personal Reimbursement** requires an **ID Card Document** for its **Purchaser**
- A **Personal Reimbursement** requires one or more **Receipts**
- A **Purchase Request** is either **Draft** or **Ready**

## Example Dialogue

> **Dev:** "If Oliver submits the request but Aidan paid for the prize, who is the purchaser?"
> **Domain expert:** "Oliver is the **Requester**. Aidan is the **Purchaser**. The student who won the prize is the **Recipient**."
>
> **Dev:** "If a **Business Purpose Template** changes after a request is ready, should the request change too?"
> **Domain expert:** "No. Templates help fill **Draft** purchase requests. **Ready** purchase requests stand on their recorded facts."

## Flagged Ambiguities

- "person" was used for requester, purchaser, and recipient; resolved: use the explicit role names **Requester**, **Purchaser**, and **Recipient**.
- "purchase" was used for both the real-world spending event and the app record; resolved: the app prepares a **Purchase Request**.
- "organization" can mean a student group or an auth/workspace concept; resolved: use **Student Organization** for the domain term.
- "event preset" describes removed implementation storage; resolved: use **Business Purpose Template** for reusable Business Purpose source text and **Event Details** for the facts recorded on a **Purchase Request**.
- Autofill sources provide draft data; resolved: a **Purchase Request** records the facts it needs rather than depending on autofill sources for meaning.
- "user profile" describes application state; resolved: use **Requester** for the domain source of requester autofill details.
- "file" describes storage; resolved: use **Document** for evidence attached to a **Purchase Request**.
- "requester is purchaser" describes the rule mechanically; resolved: use **Self Reimbursement** for that domain case.
- Current implementation requires separate front and back ID card files; resolved domain language allows one combined **ID Card Document** or separate front and back documents.
