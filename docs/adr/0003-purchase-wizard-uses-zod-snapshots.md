# Purchase Wizard Uses Zod Snapshots

The purchase wizard will use one shared Zod schema for its editable draft shape, and Convex functions for the reworked purchase flow will migrate to Zod validators through `convex-helpers`. Draft persistence will send full wizard-owned snapshots with client-side single-flight, rather than manual saves, field deltas, or server-debounced patches, because skipped intermediate saves must not lose data and the latest snapshot fully represents the current draft.

## Consequences

- Wizard form validation and Convex argument validation can share the same field shape.
- Readiness remains separate domain validation because it depends on conditional rules and document ownership.
- Convex mutations still patch stored documents, but their client contract accepts the latest editable snapshot.
