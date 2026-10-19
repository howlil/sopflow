# @sopflow/diagram

Deterministic, framework-independent layout, routing, and SVG projection engine for `@sopflow/core` workflow documents.

## Installation

```bash
pnpm add @sopflow/diagram @sopflow/core
```

## Capabilities

- **Workflow projection**: `projectWorkflow()` and `buildWorkflowEdgeId()` project a `SOPDocument` into semantic graph nodes and edges.
- **Formal SOP-AP procedure layout**: `buildProcedureModel()`, `routeProcedureEdges()`, `buildFormalProcedurePages()`, and manual route overrides (`setProcedureManualRoute`, `setProcedurePageManualRoute`, `pruneSopDiagramConfigs`).
- **BPMN lane model**: `buildBpmnModel()` projects actor lanes and routed edges.
- **Flowchart & SVG primitives**: `buildDiagram()`, `buildSopFlowchart()`, `buildSvgRenderModel()`, and orthogonal routing helpers.

## License

MIT
