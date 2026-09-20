# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are developers and workflow designers evaluating `@sopflow/core`
while building or reviewing a structured SOP. They need to see the document,
change graph operations, inspect validation, and understand the resulting state.

## Product Purpose

Sopflow models structured Standard Operating Procedures as typed documents and
graph operations. The playground makes the core package tangible by letting a
person edit a small SOP and inspect the graph, validation, operation history,
and serialized document in one place.

## Positioning

The playground is a transparent consumer of the core package: every visible
result should be traceable to a public core API rather than a UI-only rule.

## Operating Context

This is a local OSS package playground used alongside TypeScript development.
The user works with a workflow document, selects steps, changes operations,
checks graph health, and may copy or import serialized JSON.

## Capabilities and Constraints

- The core package is framework-agnostic and owns schema, graph, validation,
  mutation, operations, and history behavior.
- The playground must exercise all meaningful core features through public APIs.
- The document may be shown as a draft while an operation is being explored;
  strict batch actions must expose core validation failures.
- There are no supplied customer claims, testimonials, or external brand assets.
- The surface must remain responsive and keyboard usable.

## Brand Commitments

The name Sopflow and the structured-SOP vocabulary are confirmed. No additional
visual brand commitments were supplied; the existing dark UI is treated as
evidence, not as a binding visual system for this redesign.

## Evidence on Hand

- `packages/core` source and tests are the source of truth for package behavior.
- `apps/playground` is the current consumer surface.
- `docs/ROADMAP.md` defines the intended package milestones.
- No production data or external imagery is available; all displayed SOP data
  is clearly illustrative.

## Product Principles

- Show the graph, not a fake dashboard summary.
- Make every operation inspectable and reversible.
- Let invalid states explain themselves at the point of failure.
- Keep the core package observable without coupling it to React.

## Accessibility & Inclusion

The web surface must preserve keyboard focus, visible focus states, readable
contrast, semantic controls, responsive layouts, and reduced-motion safety.
