# Purchase Requests Record Facts

Purchase requests stand on the facts recorded into them, while requester, purchaser, student organization, and event data are autofill sources for drafts. We chose this over live references because ready requests need stable meaning after they are prepared for Engage, even when the source data changes later.

## Consequences

- Draft purchase requests may be initialized or updated from autofill sources.
- Ready purchase requests should not change meaning when autofill sources change.
- Current live references in the implementation are a transitional mismatch with the domain model.
