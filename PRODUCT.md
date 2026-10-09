# Sopflow — Product Contract

## Purpose

Sopflow is a reusable TypeScript toolkit for structured SOP authoring and visualization. It extracts a framework-neutral workflow model from the legacy sop-ta application and exposes reusable React editor components.

## Primary consumers

Developers embedding an SOP editor, workflow designers authoring structured procedures, and SOP-AP consumers requiring government-specific readiness validation.

## Core jobs

1. Model a SOP as typed actors and steps with explicit connections.
2. Edit steps and actor references without dangling graph references.
3. Render a formal SOP flowchart or BPMN diagram from the same semantic workflow.
4. Review draft validation and SOP-AP profile readiness.
5. Persist application-owned SOP, header, and diagram routing data.

## Ownership

- **core:** schema, workflow invariants, mutations, operations, history primitives.
- **diagram:** projection, layout, manual routing, route configuration; no React/DOM.
- **sop-ap:** SOP-AP-specific header and procedure readiness, separate from core rules.
- **adapter-sop-ta:** legacy procedure conversion at the compatibility boundary.
- **react:** reusable UI, interaction state, DOM measurements.
- **playground:** developer integration consumer and browser regression fixtures.

## Current UX

The playground presents a document-style workspace with SOP header, diagram preview, editable steps, properties inspector, and validation issues. Undo/redo and JSON batch operations are core capabilities, but not currently primary editor controls.

## Data ownership

`SOPDocument` is the workflow record. `header` is SOP-AP-specific metadata. `diagramConfigs` stores per-kind presentation overrides. The consuming application persists them. Strict operations validate schema plus semantics; drafts may be incomplete.

## Out of scope

Generic packages do not contain database adapters, authentication, approval lifecycle, tenant-specific settings, or sop-ta backend implementation.

See [DESIGN.md](./DESIGN.md) and [docs/CORE_CONTRACT.md](./docs/CORE_CONTRACT.md).
