import {
  getOrderedSteps,
  type SOPDocument,
  type Step,
  type StepId,
} from "@sopflow/core";
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

/** Canonical semantic connection used by all diagram projections. */
export type WorkflowConnection = WorkflowEdge;

export interface WorkflowGraph {
  readonly nodes: readonly WorkflowNode[];
  /** Includes invalid references so diagnostics never lose the source edge. */
  readonly connections: readonly WorkflowConnection[];
  /** Renderable subset whose source and target nodes both exist. */
  readonly edges: readonly WorkflowEdge[];
  readonly diagnostics: readonly DiagramDiagnostic[];
}

export function buildWorkflowEdgeId(
  from: StepId,
  kind: DiagramEdgeKind,
  to: StepId,
): string {
  return `${from}:${kind}:${to}`;
}

export function projectWorkflow(document: SOPDocument): WorkflowGraph {
  const orderedSteps = getOrderedSteps(document);
  const nodeIds = new Set(document.steps.map((step) => step.id));
  const nodes = orderedSteps.map<WorkflowNode>((step) => ({
    id: step.id,
    kind: step.type,
    label: step.name,
  }));
  const connections: WorkflowConnection[] = [];
  const edges: WorkflowEdge[] = [];
  const diagnostics: DiagramDiagnostic[] = [];

  for (const step of orderedSteps) {
    for (const connection of stepConnections(step)) {
      const edge: WorkflowEdge = {
        id: buildWorkflowEdgeId(step.id, connection.kind, connection.to),
        from: step.id,
        to: connection.to,
        kind: connection.kind,
        ...(connection.kind === "yes" || connection.kind === "no"
          ? { label: connection.kind === "yes" ? "Ya" : "Tidak" }
          : {}),
      };

      connections.push(edge);

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

  return { nodes, connections, edges, diagnostics };
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
