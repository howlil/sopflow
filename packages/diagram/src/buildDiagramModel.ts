import type { SOPDocument } from "@sopflow/core";
import type { DiagramModel, DiagramNode } from "./types.js";
import { layoutNodeText } from "./text/layoutNodeText.js";
import { projectWorkflow } from "./workflow.js";

export function buildDiagramModel(document: SOPDocument): DiagramModel {
  const workflow = projectWorkflow(document);
  const nodes = workflow.nodes.map<DiagramNode>((node) => {
    const textLayout = layoutNodeText(node.label, node.kind);

    return {
      id: node.id,
      kind: node.kind,
      label: node.label,
      text: textLayout.text,
      position: { x: 0, y: 0 },
      size: textLayout.size,
    };
  });

  return {
    nodes,
    edges: workflow.edges.map((edge) => ({ ...edge })),
    routedEdges: [],
    diagnostics: workflow.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    width: 0,
    height: 0,
  };
}
