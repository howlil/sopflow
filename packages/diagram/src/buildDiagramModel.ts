import type { SOPDocument, Step } from "@sopflow/core";
import type {
  DiagramEdge,
  DiagramEdgeKind,
  DiagramDiagnostic,
  DiagramModel,
  DiagramNode,
} from "./types.js";
import { layoutNodeText } from "./text/layoutNodeText.js";

export function buildDiagramModel(document: SOPDocument): DiagramModel {
  const nodeIds = new Set(document.steps.map((step) => step.id));
  const nodes = document.steps.map<DiagramNode>((step) => {
    const textLayout = layoutNodeText(step.name, step.type);
    return {
      id: step.id,
      kind: step.type,
      label: step.name,
      text: textLayout.text,
      position: { x: 0, y: 0 },
      size: textLayout.size,
    };
  });

  const edges: DiagramEdge[] = [];
  const diagnostics: DiagramDiagnostic[] = [];

  function pushEdge(edge: DiagramEdge): void {
    if (!nodeIds.has(edge.from)) {
      diagnostics.push({
        code: "MISSING_EDGE_SOURCE",
        edgeId: edge.id,
        from: edge.from,
        to: edge.to,
      });
      return;
    }

    if (!nodeIds.has(edge.to)) {
      diagnostics.push({
        code: "MISSING_EDGE_TARGET",
        edgeId: edge.id,
        from: edge.from,
        to: edge.to,
      });
      return;
    }

    edges.push(edge);
  }

  for (const step of document.steps) {
    for (const { kind, to } of getStepConnections(step)) {
      pushEdge({
        id: `${step.id}:${kind}:${to}`,
        from: step.id,
        to,
        kind,
        ...(kind === "yes" || kind === "no"
          ? { label: kind === "yes" ? "Ya" : "Tidak" }
          : {}),
      });
    }
  }

  return {
    nodes,
    edges,
    routedEdges: [],
    diagnostics,
    width: 0,
    height: 0,
  };
}

function getStepConnections(
  step: Step,
): Array<{ kind: DiagramEdgeKind; to: string }> {
  switch (step.type) {
    case "start":
    case "task":
      return [{ kind: "next", to: step.next }];
    case "decision":
      return [
        { kind: "yes", to: step.yes },
        { kind: "no", to: step.no },
      ];
    case "end":
      return [];
  }
}
