import type { FlowchartRouteConnection } from "./types.js";

export type FlowchartRouteComplexity = "simple" | "medium" | "complex";

export function rowSpanBetween(
  connection: Pick<FlowchartRouteConnection, "fromRow" | "toRow">,
): number {
  return Math.abs(connection.toRow - connection.fromRow);
}

export function isSimpleSequentialFlow(
  connection: FlowchartRouteConnection,
  geometry: {
    destAbove: boolean;
    destBelow: boolean;
    sameCol: boolean;
    isCrossColumn: boolean;
  },
): boolean {
  if (!geometry.destBelow || geometry.destAbove) return false;
  if (connection.toRow !== connection.fromRow + 1) return false;
  if (connection.sourceType === "flowchart-decision") return false;
  if (connection.label) return false;
  return true;
}

export function classifyFlowchartRouteComplexity(
  connection: FlowchartRouteConnection,
  geometry: {
    destAbove: boolean;
    destBelow: boolean;
    sameCol: boolean;
    isCrossColumn: boolean;
  },
): FlowchartRouteComplexity {
  if (isSimpleSequentialFlow(connection, geometry)) return "simple";
  if (geometry.destAbove) return "complex";

  const span = rowSpanBetween(connection);
  if (geometry.isCrossColumn && span >= 2) return "complex";
  if (connection.sourceType === "flowchart-decision") return "medium";
  return "medium";
}
