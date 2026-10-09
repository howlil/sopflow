# Sopflow Design Contract

## Current surface

The primary UI is an A4-like SOP document workspace with a properties inspector, not the previous horizontal JSON operation workbench. The playground is a local integration consumer of `@sopflow/react`.

## Information hierarchy

1. Document header: title, institution, SOP metadata, and supporting lists.
2. Main document surface: preview of a formal SOP flowchart or BPMN diagram.
3. Step editing: table on wide screens; compact step cards on narrow screens.
4. Properties inspector: header and actor editing.
5. Validation: visible readiness issues combining graph and SOP-AP requirements.

## Interaction contract

- Editing steps changes canonical `SOPDocument` and reprojects diagrams.
- Selected steps remain consistent across preview and editor.
- Manual flowchart/BPMN routing changes use per-kind `diagramConfigs`, never workflow mutations.
- Invalid drafts stay visible with explanation; strict operations reject invalid final states.
- Embedding applications own save, load, and error states.
- Read-only/loading modes disable mutations.
- Keyboard access, focus indication, responsive layouts, and reduced-motion support remain requirements.

## Implementation boundaries

- Domain rules: `@sopflow/core`; SOP-AP readiness: `@sopflow/sop-ap`.
- Geometry, routing, diagram configuration: `@sopflow/diagram`.
- DOM measurement and React/SVG presentation: `@sopflow/react`.
- Shared procedure shape, measurement, and formatting helpers: `packages/react/src/diagram/procedureShared.tsx`. Avoid duplicating between single-page/paginated rendering.
- React CSS tokens: `packages/react/src/styles/token.css`.

## Verification

Unit and component tests guard graph mutations, editing, diagram routing, pagination, and accessibility. CI runs a headless browser diagram regression.
