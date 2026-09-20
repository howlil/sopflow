import type { SOPDocument, Step } from "@sopflow/core";
import type {
  DiagramEdge,
  DiagramEdgeKind,
  DiagramModel,
  DiagramNode,
  DiagramNodeKind,
  DiagramSize,
} from "./types.js";

const NODE_SIZES: Record<DiagramNodeKind, DiagramSize> = {
  start: { width: 160, height: 56 },
  task: { width: 192, height: 72 },
  decision: { width: 208, height: 88 },
  end: { width: 160, height: 56 },
};

export function buildDiagramModel(document: SOPDocument): DiagramModel {
  const nodes = document.steps.map<DiagramNode>((step) => ({
    id: step.id,
    kind: step.type,
    label: step.name,
    position: { x: 0, y: 0 },
    size: { ...NODE_SIZES[step.type] },
  }));

  const edges = document.steps.flatMap((step) =>
    getStepConnections(step).map<DiagramEdge>(({ kind, to }) => ({
      id: `${step.id}:${kind}:${to}`,
      from: step.id,
      to,
      kind,
      ...(kind === "yes" || kind === "no"
        ? { label: kind === "yes" ? "Ya" : "Tidak" }
        : {}),
    })),
  );

  return {
    nodes,
    edges,
    routedEdges: [],
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
