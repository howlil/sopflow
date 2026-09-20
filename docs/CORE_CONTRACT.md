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
