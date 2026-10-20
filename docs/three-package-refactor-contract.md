# SOPFlow — three public packages ($design-thinking / $design-graph)

## Goal
Preserve all SOP-AP validation, generic graph semantics, SOP-TA strict conversion, React issue handling, browser preview and routing while publishing only `@sopflow/core`, `@sopflow/diagram` and `@sopflow/react`.

## Expected implementation graph
`SOPDocument + SopApHeader → core graph/schema validation → core/sop-ap header/procedure readiness → React onReadinessChange → unified Problems panel → field navigation`; adapter legacy DTO ⇄ private integration ⇄ core document; diagram and manual route validation remain owned by diagram.

## A/E/R
A = deterministic, ordered `SopApReadinessIssue[]` / success or explicit SOP-TA import diagnostics; E = invalid schema/actor count/decision/legacy conversion, tarball missing export and version mismatch; R = pure TypeScript code, pnpm workspace, npm publishing workflow. No new runtime service, persistence or background process.

## C/V/N
SopUnifiedWorkspace C=flowchart/BPMN/steps/properties/Problems; V=valid, invalid, selected, editing, disabled, read-only, route dragging, route rejected; N=document/header, callbacks and editor permissions. Problems C=issue list/navigation; V=empty/collapsed/expanded/issue-target missing; N=readiness data. Preserve focus, keyboard, screen size and print output.

## Gates and rollout
M1: core SOP-AP subpath + React imports + source-parity tests. M2: move legacy adapter to private workspace, retain tests. M3: remove two published packages and five-package release assumptions; assert exactly three verified tarballs. M4: publish new three-package versions from green CI; update Playground npm pins only after registry publication. Do not unpublish historic packages. Per-milestone code review inspects changed dependency and runtime graphs.
