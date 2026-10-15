# Design-thinking hardening — SOPFlow (15 October 2026)

Scope: `@sopflow/core`, `@sopflow/sop-ap`, `@sopflow/adapter-sop-ta`,
`@sopflow/diagram` and `@sopflow/react`. SOPFlow is an embeddable
library; persistence, authorization and deployment belong to its host.

## 1. Observe: critical user journeys

1. Author workflow and incomplete drafts without blocking typing.
2. Edit manual edge routes across multiple procedure pages.
3. Resize viewport, print, or change A4 pagination without losing edits.
4. Import SOP-TA rows without silently discarding actor/branch/duration data.
5. Validate SOP-AP publication and export to external consumers.
6. Interact with long workflows without duplicated controllers per row.

## 2. Define: invariant graph

```text
  Host SOPDocument                   Host diagramConfigs
        |                                    |
        v                                    v
  Core schema/graph                  Semantic workflow edge IDs
        |                                    |
        +--> SOP-AP readiness                +--> View-local pagination
        |                                         |
        +--> Strict SOP-TA adapter                +--> Active route selection
        |
        +--> React editor (single responsive subtree)
                         |
                         +--> Diagram route planner
                                  |
                                  +--> Broad-phase spatial filtering
                                  +--> Exact crossing/overlap predicates
```

**Non-negotiable invariants**

- The persisted route key belongs to the semantic edge, not a page-local OPC
  segment. Reflow must never delete its manual override.
- Removing a semantic edge *may* prune a route override.
- UI permits incomplete drafts. Publication readiness rejects decision branches
  that both point to the same target.
- Strict import rejects contradictory or unrepresentable fields; legacy
  compatibility import keeps its established behavior.
- Export verifies the document before deciding the SOP-TA subset can represent it.
- Route quality can use a conservative spatial prefilter, but cannot skip an
  actual crossing or overlap.
- The renderer may cache or index pure projections, but host-controlled props
  remain the source of truth.

## 3. Design: ownership and complexity

| Boundary | Ownership | Change |
| --- | --- | --- |
| Core | Domain schema and graph semantics | Resolve schema diagnostic paths to step IDs |
| SOP-AP | Publication profile | Block identical decision branch targets at readiness |
| Adapter | Legacy compatibility | Detect ignored and conflicting fields; validate export |
| Diagram | Pure geometry and route planning | Keep pagination local; grid-index quality candidates |
| React | Controlled state and interaction | Group diagnostics/order; mount one responsive subtree |
| CI | Evidence | Unit regression, DOM browser checks, screenshot and print captures |

Editor formerly mounted both desktop and mobile React trees; now only one is
active. A shared step-order map avoids computing graph order once per row. The
route-quality index reduces broad-phase candidate comparisons; worst-case
overlap-heavy graphs can still require quadratic exact checks.

## 4. Verify: minimal executable proof

| Risk | Test boundary | Evidence |
| --- | --- | --- |
| Page reflow wipes routes | Diagram unit + React controlled component | Cross-page-to-local retains config |
| Invalid decision is published | SOP-AP readiness unit | Identical Yes/No rejected |
| SOP-TA loses fields | Adapter tests | Actor conflict, branch metadata, duration unit |
| Invalid SOP-TA export | Adapter unit | Invalid actor reference rejected |
| Schema error cannot target step | Core schema unit | Issue contains originating step ID |
| Spatial optimization changes geometry quality | Diagram unit | Indexed versus exhaustive scores equal |
| Print and complex diagram break | Headless Chrome | DOM smoke, screenshot and print PDF artifacts |

Run:
```sh
pnpm check
bash scripts/check-browser-diagrams.sh
pnpm --filter @sopflow/diagram bench:routes
```

Screenshots and PDFs are **review evidence, not golden pixel diff tests**.
Benchmark results should compare identical machines, runtime versions, graph
fixtures and repeated runs. No speedup claim is made without measurements.

## 5. Iterate: failure response

- Any import/export data inconsistency: block strict operation, return issues,
  and preserve original input.
- Any persistence mutation on reflow: revert pruning; only semantic-edge
  deletion should remove saved routes.
- Any spatial-scoring disagreement: restore exhaustive scoring, keep the
  deterministic parity fixture, then diagnose bounding-box indexing.
- Any hydration or responsive glitch: preserve the server snapshot and verify
  browser matchMedia subscriptions.
