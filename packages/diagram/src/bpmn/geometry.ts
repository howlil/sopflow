import type { DiagramPoint } from "../types.js";
import type { BpmnNode } from "./types.js";
import { layoutNodeText } from "../text/layoutNodeText.js";

interface BpmnNodeMetrics {
  readonly width: number;
  readonly height: number;
  readonly footprintWidth: number;
  readonly footprintHeight: number;
  readonly labelLines: readonly string[];
  readonly labelLineHeight: number;
}

export function measureBpmnNode(
  kind: BpmnNode["kind"],
  label: string,
): BpmnNodeMetrics {
  const labelLayout = layoutNodeText(label, kind, {
    maxCharsPerLine: kind === "task" ? 22 : 18,
    lineHeight: 14,
    horizontalPadding: 16,
    verticalPadding: 10,
    minWidth: 48,
    maxWidth: 200,
  });
  const labelLines = labelLayout.text.lines;
  const labelLineHeight = labelLayout.text.lineHeight;
  const longestLine = Math.max(1, ...labelLines.map((line) => line.length));
  const estimatedLabelWidth = clamp(
    longestLine * 6.2 + 20,
    kind === "task" ? 96 : 48,
    200,
  );

  if (kind === "task") {
    const width = estimatedLabelWidth;
    const height = Math.max(48, labelLines.length * labelLineHeight + 20);
    return {
      width,
      height,
      footprintWidth: width,
      footprintHeight: height,
      labelLines,
      labelLineHeight,
    };
  }

  const shapeSize = kind === "decision" ? 48 : 38;
  return {
    width: shapeSize,
    height: shapeSize,
    footprintWidth: Math.max(shapeSize, estimatedLabelWidth),
    footprintHeight: shapeSize + 10 + labelLines.length * labelLineHeight,
    labelLines,
    labelLineHeight,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function compactOrthogonalPoints(
  points: readonly DiagramPoint[],
): DiagramPoint[] {
  const result: DiagramPoint[] = [];

  for (const point of points) {
    const previous = result.at(-1);
    if (previous?.x === point.x && previous.y === point.y) continue;
    result.push({ x: point.x, y: point.y });
  }

  return result;
}

export function positive(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value ?? 0) > 0
    ? (value as number)
    : fallback;
}

export function nonNegative(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value ?? -1) >= 0
    ? (value as number)
    : fallback;
}
