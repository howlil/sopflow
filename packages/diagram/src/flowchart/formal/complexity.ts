import type { FormalRouteMeta } from "./dedicated.js";

export type FormalFlowchartRouteComplexity =
  | "simple"
  | "medium"
  | "complex";

export interface FormalRouteComplexityInput {
  readonly fromRow: number;
  readonly toRow: number;
  readonly sameColumn: boolean;
  readonly crossColumn: boolean;
  readonly sourceType: FormalRouteMeta["sourceType"];
  readonly targetType: FormalRouteMeta["targetType"];
  readonly label?: string | null;
}

export function formalRowSpan(input: {
  readonly fromRow: number;
  readonly toRow: number;
}): number {
  return Math.abs(input.toRow - input.fromRow);
}

export function isSimpleSequentialFormalFlow(
  input: FormalRouteComplexityInput,
): boolean {
  if (input.toRow !== input.fromRow + 1) return false;
  if (input.sourceType === "flowchart-decision") return false;
  if (input.label) return false;
  return true;
}

export function classifyFormalFlowchartRouteComplexity(
  input: FormalRouteComplexityInput,
): FormalFlowchartRouteComplexity {
  if (isSimpleSequentialFormalFlow(input)) return "simple";

  const destinationAbove = input.toRow < input.fromRow;
  if (destinationAbove) return "complex";

  const span = formalRowSpan(input);
  if (input.crossColumn && span >= 2) return "complex";
  if (input.sourceType === "flowchart-decision") return "medium";
  if (span >= 3) return "medium";

  return "medium";
}
