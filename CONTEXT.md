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

**Filled**:
A ready purchase request that has reached Engage review through the extension.
_Avoid_: Submitted, approved

**Approved**:
A purchase request the requester has manually marked as approved after Engage review.
_Avoid_: Complete, accepted

**Sent Back**:
A filled purchase request the requester reports Engage's reviewer returned. It reopens as a **Draft** and keeps the reviewer's note until it is filled again.
_Avoid_: Rejected, denied, returned

**Stage**:
Where a purchase request sits in its lifecycle, derived from its status and facts rather than stored: Reading, After the event, To finish, Ready, Filled, or Approved.
_Avoid_: Status, state, column

**After the event**:
The **Stage** of a **Draft** whose receipt facts are in and whose **Activity** is today, later, or undated, with more than a week left in its **Reimbursement Window**. It is only a grouping; nothing waits on the event date.
_Avoid_: Tracked, pending, blocked

**Reimbursement Window**:
The 30 days after a **Receipt**'s date in which Engage expects a **Personal Reimbursement**. Its last week moves a **Draft** to To finish whatever its **Activity** dates.
_Avoid_: Deadline, grace period

**Allocation**:
The amount a **Student Organization** was given for one **Budget Line Item** in one fiscal year (July 1 to June 30). A **Budget Line Item** without one is untracked.
_Avoid_: Budget, limit, balance

**Engage**:
The University of Oregon platform where purchase requests are reviewed and submitted.
_Avoid_: RTP, form backend

**Business Purpose**:
The narrative explanation of why a purchase request benefits the student organization or event. It is generated from the request's recorded facts unless the requester customizes it.
_Avoid_: Purpose text, reimbursement description

**Reimbursement Reason**:
The explanation for choosing reimbursement instead of another purchasing process.
_Avoid_: Reason, business purpose, justification

**Fund**:
One of the two ASUO spending categories a purchase is paid from: Administrative or Programming. Engage's Line Item field gets the amount from each, like "$55.00 from Administrative".
_Avoid_: Category (that means **Documentation Categories**), budget line, account

**Budget Line Item**:
An optional, organization-defined line under one **Fund**, like "Weekly Musical Discussion Events" under Programming. Only used for the organization's own budget tracking; Engage never sees it.
_Avoid_: Budget line, category, account

**Budget Split**:
The part of a **Purchase Request**'s total charged to one **Budget Line Item**, or to a **Fund** when the organization has no lines.
_Avoid_: Allocation, share

**Fund Letter**:
The Engage funding code letter for a student organization's money source.
_Avoid_: Fund (that is Administrative or Programming), fund context

**ASUO Funds**:
The documentation category for events funded by ASUO-administered student organization money.
_Avoid_: ASUO fund context

**Merchandise/Apparel/Gifts**:
The documentation category for requests involving designs for merchandise, apparel, or gifts.
_Avoid_: Gift path, apparel category

**Student Organization**:
The University of Oregon student group whose funding details may be copied into purchase requests.
_Avoid_: Organization, account, workspace

**Event**:
A saved, named activity a Student Organization holds, such as a weekly listening event, with its usual weekday, time, location, typical attendance, and whether it is open to all students.
_Avoid_: Meeting, event preset, template

**Activity**:
The event facts a purchase request records for itself: which Event, its name, the date or dates the purchase was used, the time, location, attendance, and whether it was open to all students.
_Avoid_: Event details, activity date

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
A document showing one side of a purchaser's UO ID card. Both the front and the back are required.
_Avoid_: ID card image, ID file, card upload

## Relationships

- A **Student Organization** funds one or more **Purchase Requests**
- A **Student Organization** may provide default details copied into **Draft** purchase requests
- A **Student Organization** has zero or more **Events**
- A **Purchaser** may provide default details copied into **Draft** personal reimbursement requests
- A **Requester** may provide default details copied into **Draft** purchase requests
- Choosing an **Event** copies its facts into a **Draft**'s **Activity**; later edits to either do not change the other
- A new **Draft** copies the previous request's **Activity**, without its dates
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
- A **Purchase Request** records exactly one **Activity**, which may come from an **Event**
- An **Activity** has one or more dates when the purchase was used
- A **Purchase Request** has exactly one **Business Purpose**, generated from its facts or customized
- A **Personal Reimbursement** has exactly one **Reimbursement Reason**
- A **Purchase Request** has one or more **Budget Splits**; with more than one, their amounts add up to the total
- A **Budget Line Item** belongs to exactly one **Fund**
- A **Budget Line Item** has at most one **Allocation** per fiscal year
- A **Purchase Request** may have one or more **Recipients**
- A **Purchase Request** may have one or more **Documents**
- A **Purchase Request** for an event using **ASUO Funds** requires **Publicity Proof**
- A **Purchase Request** with **Merchandise/Apparel/Gifts** may have one or more **Recipients**
- A **Self Reimbursement** requires **Second Approval**
- A **Personal Reimbursement** requires an **ID Card Document** for its **Purchaser**
- A **Personal Reimbursement** requires one or more **Receipts**
- A **Purchase Request** is **Draft**, **Ready**, or **Approved**
- A **Purchase Request** has exactly one **Stage**, derived from its status and facts
- A **Draft** that meets every requirement is at the **Ready** **Stage** and can be filled, whatever its **Activity** dates
- A **Draft** being read is at the Reading **Stage** until its **Documents** are read
- A **Draft** missing requirements is **After the event** or To finish; its **Reimbursement Window**'s last week makes it To finish
- A **Sent Back** purchase request is a **Draft** at the To finish **Stage** until it is filled again
- A **Filled** purchase request remains **Ready** until manually marked **Approved** or **Sent Back**
- An **Approved** purchase request may be reopened as **Filled** or **Ready**
- Editing an **Approved** purchase request returns it to **Ready**

## Example Dialogue

> **Dev:** "If Oliver submits the request but Aidan paid for the prize, who is the purchaser?"
> **Domain expert:** "Oliver is the **Requester**. Aidan is the **Purchaser**. The student who won the prize is the **Recipient**."
>
> **Dev:** "If the club moves its weekly **Event** to a new room, do old requests change too?"
> **Domain expert:** "No. The **Event** only fills a **Draft**'s **Activity**. **Ready** purchase requests stand on their recorded facts."

## Flagged Ambiguities

- "person" was used for requester, purchaser, and recipient; resolved: use the explicit role names **Requester**, **Purchaser**, and **Recipient**.
- "purchase" was used for both the real-world spending event and the app record; resolved: the app prepares a **Purchase Request**.
- "organization" can mean a student group or an auth/workspace concept; resolved: use **Student Organization** for the domain term.
- "event preset" and "Business Purpose Template" describe removed implementation storage; resolved: use **Event** for the saved, reusable activity and **Activity** for the facts recorded on a **Purchase Request**.
- "meeting" was used for club events; resolved: say **Event**. Reviewers deny funding for meetings, and a private gathering should be recorded as not open to all students rather than renamed.
- Autofill sources provide draft data; resolved: a **Purchase Request** records the facts it needs rather than depending on autofill sources for meaning.
- "user profile" describes application state; resolved: use **Requester** for the domain source of requester autofill details.
- "file" describes storage; resolved: use **Document** for evidence attached to a **Purchase Request**.
- "requester is purchaser" describes the rule mechanically; resolved: use **Self Reimbursement** for that domain case.
- A purchaser needs two **ID Card Documents**: the front and the back of their UO ID card.
- "status" was used for both the stored Draft/Ready/Approved value and the board's groups; resolved: status is stored, **Stage** is derived.
- "after the event" once meant filling was blocked until the event; resolved: **After the event** is only a grouping, and filling waits on requirements alone.
