import type { DiagramPoint } from "./types.js";
import { pathToSegments, type DiagramRect } from "./routeGeometry.js";

export interface RouteLabelPlacement {
  readonly position: DiagramPoint;
  readonly bounds: DiagramRect;
}

export interface RouteLabelPlacementInput {
  readonly path: readonly DiagramPoint[];
  readonly label: string;
  readonly obstacles?: readonly DiagramRect[];
  readonly occupiedLabels?: readonly DiagramRect[];
  readonly perpendicularOffset?: number;
  readonly fontHeight?: number;
  readonly charWidth?: number;
  readonly horizontalPadding?: number;
  readonly verticalPadding?: number;
}

export function placeRouteLabel(
  input: RouteLabelPlacementInput,
): RouteLabelPlacement | null {
  const {
    path,
    label,
    obstacles = [],
    occupiedLabels = [],
    perpendicularOffset = 18,
    fontHeight = 12,
    charWidth = 6.5,
    horizontalPadding = 8,
    verticalPadding = 4,
  } = input;
  const trimmed = label.trim();
  if (!trimmed || path.length < 2) return null;

  const width = Math.max(18, trimmed.length * charWidth + horizontalPadding * 2);
  const height = fontHeight + verticalPadding * 2;
  const segments = pathToSegments(path)
    .map((segment, index) => ({
      segment,
      index,
      length:
        Math.abs(segment.x2 - segment.x1) + Math.abs(segment.y2 - segment.y1),
    }))
    .filter(({ length }) => length > 0)
    .sort((left, right) => right.length - left.length || left.index - right.index);

  if (segments.length === 0) return null;

  const candidates: RouteLabelPlacement[] = [];
  for (const { segment } of segments) {
    const midpoint = {
      x: (segment.x1 + segment.x2) / 2,
      y: (segment.y1 + segment.y2) / 2,
    };
    const horizontal = segment.y1 === segment.y2;
    const offsets = [
      perpendicularOffset,
      -perpendicularOffset,
      perpendicularOffset + 12,
      -(perpendicularOffset + 12),
      0,
    ];

    for (const offset of offsets) {
      const position = horizontal
        ? { x: midpoint.x, y: midpoint.y + offset }
        : { x: midpoint.x + offset, y: midpoint.y };
      const bounds = {
        left: position.x - width / 2,
        top: position.y - height / 2,
        width,
        height,
      };
      candidates.push({ position, bounds });
    }
  }

  return (
    candidates.find(
      ({ bounds }) =>
        !obstacles.some((rect) => rectsOverlap(bounds, inflateRect(rect, 4))) &&
        !occupiedLabels.some((rect) =>
          rectsOverlap(bounds, inflateRect(rect, 4)),
        ),
    ) ??
    candidates[0] ??
    null
  );
}

export function rectsOverlap(left: DiagramRect, right: DiagramRect): boolean {
  return (
    left.left < right.left + right.width &&
    left.left + left.width > right.left &&
    left.top < right.top + right.height &&
    left.top + left.height > right.top
  );
}

function inflateRect(rect: DiagramRect, margin: number): DiagramRect {
  return {
    left: rect.left - margin,
    top: rect.top - margin,
    width: rect.width + margin * 2,
    height: rect.height + margin * 2,
  };
}
