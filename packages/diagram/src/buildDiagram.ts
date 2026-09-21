import type { SOPDocument } from "@sopflow/core";
import { buildDiagramModel } from "./buildDiagramModel.js";
import { layoutDiagram, type DiagramLayoutOptions } from "./layout.js";
import { routeDiagramEdges, type EdgeRoutingOptions } from "./routeEdges.js";
import { buildSvgRenderModel } from "./svg/buildSvgRenderModel.js";
import type { SvgRenderModel } from "./svg/types.js";

export interface BuildDiagramOptions {
  layout?: DiagramLayoutOptions;
  routing?: EdgeRoutingOptions;
}

export function buildDiagram(
  document: SOPDocument,
  options: BuildDiagramOptions = {},
): SvgRenderModel {
  const graph = buildDiagramModel(document);
  const layout = layoutDiagram(graph, options.layout);
  const routed = routeDiagramEdges(layout, options.routing);

  return buildSvgRenderModel(routed);
}
