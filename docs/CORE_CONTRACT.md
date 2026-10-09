# Sopflow Core Contract

`@sopflow/core` owns the SOP workflow invariants. Consumers may render or persist
an `SOPDocument`, but they must not reimplement graph rules.

## Valid document

`parseSop()` accepts a document only when:

- it has exactly one `start` step;
- it has at least one `end` step;
- every `next`, `yes`, and `no` reference points to an existing step;
- every actor reference points to an existing actor;
- step IDs are unique;
- actor IDs are unique;
- every step is reachable from `start`;
- every non-end step can eventually reach an `end` step.

The current v1 contract permits multiple terminal `end` steps and workflow cycles.
Cycles are still required to have a path to an end step.

## Mutation states

Low-level mutation functions enforce local structural safety: IDs, source/target
existence, actor references, and protected references. A composed editor action
can still be a draft until its final state is passed to
`applyValidatedOperations()`.

`steps` is a collection, not an execution-order list. Execution and display order
are derived from graph edges with `getOrderedSteps()`.

## Strict operations and drafts

`applyOperations()` and low-level mutations may create intermediate drafts while enforcing local reference safety. `applyValidatedOperations()` validates the **final** document against the same Zod schema and semantic workflow rules as `parseSop()`. Schema failures appear in `SopCoreError.details.schemaIssues`; graph validation failures remain in `details.issues`.

`SOPDocument` owns graph semantics and optional authored `presentationOrder`. SOP-AP header metadata and diagram manual route configs are separate application-persisted state. Embedding applications should persist `value`, `header`, and `diagramConfigs` together.

Diagram edge IDs escape `%` and `:` within step IDs. `pruneSopDiagramConfigs()` migrates unambiguous legacy route keys; ambiguous collisions are dropped rather than mapped onto the wrong edge.
