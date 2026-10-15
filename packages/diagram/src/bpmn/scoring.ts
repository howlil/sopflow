import type { BpmnModel, BpmnRoutedEdge } from "./types.js";

export function scoreBpmnEdges(edges: readonly BpmnRoutedEdge[]): number {
  return edges.reduce((score, edge) => {
    if (edge.points.length < 2) return score + 1_000_000_000;
    const quality = edge.quality;
    if (!quality) return score + 500_000;

    return (
      score +
      quality.obstacleHits * 100_000 +
      quality.overlaps * 25_000 +
      quality.crossings * 10_000 +
      quality.bends * 120 +
      quality.length +
      (edge.routeKind === "fallback" ? 50_000 : 0)
    );
  }, 0);
}

export function scoreBpmnPlan(model: BpmnModel): number {
  return scoreBpmnEdges(model.edges);
}
