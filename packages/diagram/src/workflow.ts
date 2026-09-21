import type { SOPDocument, Step, StepId } from "@sopflow/core";
import type { DiagramDiagnostic, DiagramEdgeKind } from "./types.js";

export interface WorkflowNode {
  readonly id: StepId;
  readonly kind: Step["type"];
  readonly label: string;
}

export interface WorkflowEdge {
  readonly id: string;
  readonly from: StepId;
  readonly to: StepId;
  readonly kind: DiagramEdgeKind;
  readonly label?: string;
}

export interface WorkflowGraph {
  readonly nodes: readonly WorkflowNode[];
  readonly edges: readonly WorkflowEdge[];
  readonly diagnostics: readonly DiagramDiagnostic[];
}

export function projectWorkflow(document: SOPDocument): WorkflowGraph {
  const nodeIds = new Set(document.steps.map((step) => step.id));
  const nodes = document.steps.map<WorkflowNode>((step) => ({
    id: step.id,
    kind: step.type,
    label: step.name,
  }));
  const edges: WorkflowEdge[] = [];
  const diagnostics: DiagramDiagnostic[] = [];

  for (const step of document.steps) {
    for (const connection of stepConnections(step)) {
      const edge: WorkflowEdge = {
        id: `${step.id}:${connection.kind}:${connection.to}`,
        from: step.id,
        to: connection.to,
        kind: connection.kind,
        ...(connection.kind === "yes" || connection.kind === "no"
          ? { label: connection.kind === "yes" ? "Ya" : "Tidak" }
          : {}),
      };

      if (!nodeIds.has(edge.from)) {
        diagnostics.push({
          code: "MISSING_EDGE_SOURCE",
          edgeId: edge.id,
          from: edge.from,
          to: edge.to,
        });
        continue;
      }

      if (!nodeIds.has(edge.to)) {
        diagnostics.push({
          code: "MISSING_EDGE_TARGET",
          edgeId: edge.id,
          from: edge.from,
          to: edge.to,
        });
        continue;
      }

      edges.push(edge);
    }
  }

  return { nodes, edges, diagnostics };
}

function stepConnections(
  step: Step,
): ReadonlyArray<{ readonly kind: DiagramEdgeKind; readonly to: StepId }> {
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
