import type { DiagramModel, DiagramNode, DiagramPoint } from "../types.js";
import { pointsToPath } from "./pointsToPath.js";
import type { SvgNodeModel, SvgRenderModel } from "./types.js";

export function buildSvgRenderModel(model: DiagramModel): SvgRenderModel {
  return {
    width: model.width,
    height: model.height,
    nodes: model.nodes.map(buildSvgNode),
    edges: model.routedEdges.map((edge) => {
      const labelPosition = edge.label
        ? findLabelPosition(edge.points)
        : undefined;
      const result = {
        id: edge.id,
        from: edge.from,
        to: edge.to,
        kind: edge.kind,
        path: pointsToPath(edge.points),
        ...(edge.label ? { label: edge.label } : {}),
        ...(labelPosition ? { labelPosition } : {}),
      };

      return result;
    }),
    diagnostics: model.diagnostics,
  };
}

function buildSvgNode(node: DiagramNode): SvgNodeModel {
  return {
    id: node.id,
    kind: node.kind,
    label: node.label,
    lines: node.text.lines,
    lineHeight: node.text.lineHeight,
    x: node.position.x,
    y: node.position.y,
    width: node.size.width,
    height: node.size.height,
    shape: getNodeShape(node),
  };
}

function getNodeShape(node: DiagramNode): SvgNodeModel["shape"] {
  switch (node.kind) {
    case "decision":
      return "diamond";
    case "start":
    case "end":
      return "rounded";
    case "task":
      return "rect";
  }
}

function findLabelPosition(points: DiagramPoint[]): DiagramPoint | undefined {
  if (points.length < 2) {
    return undefined;
  }

  let best:
    | { length: number; start: DiagramPoint; end: DiagramPoint }
    | undefined;

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];

    if (!start || !end) {
      continue;
    }

    const length = Math.abs(end.x - start.x) + Math.abs(end.y - start.y);

    if (!best || length > best.length) {
      best = { length, start, end };
    }
  }

  if (!best) {
    return undefined;
  }

  return {
    x: (best.start.x + best.end.x) / 2,
    y: (best.start.y + best.end.y) / 2,
  };
}
