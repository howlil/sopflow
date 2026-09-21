import type { DiagramPoint } from "../../types.js";
import type { FormalFlowchartRect, FormalFlowchartSide } from "./types.js";

export type FormalFlowchartAnchorKind = "start" | "end";

export interface FormalFlowchartPathAnchor extends DiagramPoint {
  readonly id: string;
  readonly side: FormalFlowchartSide;
  readonly kind: FormalFlowchartAnchorKind;
}

export interface FormalFlowchartShapeSnapTargets {
  readonly connectionId: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly start: FormalFlowchartRect | null;
  readonly end: FormalFlowchartRect | null;
  readonly startIsDiamond?: boolean;
  readonly endIsDiamond?: boolean;
}

export interface FormalFlowchartShapeEdgeProjection extends DiagramPoint {
  readonly side: FormalFlowchartSide;
  readonly distance: number;
  readonly distanceToEdge: number;
}

export interface FormalFlowchartMagneticSnapResult {
  readonly anchor: FormalFlowchartPathAnchor;
  readonly distance: number;
  readonly ratio: number;
  readonly x: number;
  readonly y: number;
  readonly hardSnapped: boolean;
}

export interface FormalFlowchartEdgeSnapResult extends DiagramPoint {
  readonly anchorId: string;
  readonly side: FormalFlowchartSide;
  readonly distance: number;
  readonly distanceToEdge: number;
  readonly ratio: number;
  readonly hardSnapped: boolean;
}

export const FORMAL_CENTER_SNAP_THRESHOLD_PX = 14;
export const FORMAL_ANCHOR_CHANNEL_SPACING_PX = 14;
export const FORMAL_ANCHOR_OFF_CENTER_PENALTY_PER_TENTH = 150;

const AUTO_ANCHOR_SLOT_DISTANCES = [
  0.5, 0.28, 0.72, 0.18, 0.82, 0.4, 0.6,
] as const;
const VISUAL_ANCHOR_SLOT_DISTANCES = [0.5, 0.28, 0.72] as const;
const DIAMOND_VERTEX_DISTANCE = 0.5;
const EDGE_ZONE_RATIO = 0.32;
const EDGE_ZONE_MARGIN_PX = 36;

export function formalSnapDistanceToCenter(
  distance: number,
  sideLength: number,
  thresholdPx = FORMAL_CENTER_SNAP_THRESHOLD_PX,
): number {
  if (sideLength <= 0) return 0.5;
  const offsetPx = Math.abs(distance - 0.5) * sideLength;
  return offsetPx <= thresholdPx ? 0.5 : distance;
}

export function formalSideLengthPx(
  rect: FormalFlowchartRect,
  side: FormalFlowchartSide,
): number {
  return side === "top" || side === "bottom" ? rect.width : rect.height;
}

export function getFormalAutoRouteAnchorSlot(slotIndex: number): number {
  return (
    AUTO_ANCHOR_SLOT_DISTANCES[slotIndex % AUTO_ANCHOR_SLOT_DISTANCES.length] ??
    0.5
  );
}

export function formalChannelAnchorDistance(
  channelIndex: number,
  sideLength: number,
): number {
  if (sideLength <= 0 || channelIndex <= 0) return 0.5;

  const step = FORMAL_ANCHOR_CHANNEL_SPACING_PX / sideLength;
  const half = Math.ceil(channelIndex / 2);
  const sign = channelIndex % 2 === 1 ? -1 : 1;
  return Math.max(0.08, Math.min(0.92, 0.5 + sign * half * step));
}

export function preferFormalCenterAnchorDistance(
  usedCount: number,
  sideLength: number,
): number {
  return usedCount <= 0
    ? 0.5
    : formalChannelAnchorDistance(usedCount, sideLength);
}

export function scoreFormalAnchorOffCenter(distance: number): number {
  return (
    Math.abs(distance - 0.5) * 10 * FORMAL_ANCHOR_OFF_CENTER_PENALTY_PER_TENTH
  );
}

export function formalDistanceOnShapeEdge(
  rect: FormalFlowchartRect,
  side: FormalFlowchartSide,
  point: DiagramPoint,
): number {
  if (side === "top" || side === "bottom") {
    if (rect.width <= 0) return 0.5;
    return clamp01((point.x - rect.left) / rect.width);
  }

  if (rect.height <= 0) return 0.5;
  return clamp01((point.y - rect.top) / rect.height);
}

export function formalPointOnShapeEdge(
  rect: FormalFlowchartRect,
  side: FormalFlowchartSide,
  distance: number,
): DiagramPoint {
  const ratio = clamp01(distance);
  const right = rect.left + rect.width;
  const bottom = rect.top + rect.height;

  switch (side) {
    case "top":
      return {
        x: Math.round(rect.left + rect.width * ratio),
        y: Math.round(rect.top),
      };
    case "bottom":
      return {
        x: Math.round(rect.left + rect.width * ratio),
        y: Math.round(bottom),
      };
    case "left":
      return {
        x: Math.round(rect.left),
        y: Math.round(rect.top + rect.height * ratio),
      };
    case "right":
      return {
        x: Math.round(right),
        y: Math.round(rect.top + rect.height * ratio),
      };
  }
}

export function buildFormalEdgeAnchorId(
  connectionId: string,
  kind: FormalFlowchartAnchorKind,
  side: FormalFlowchartSide,
): string {
  return `${connectionId}-${kind}-${side}`;
}

export function parseFormalLockedSideFromAnchorId(
  anchorId: string | null | undefined,
  kind: FormalFlowchartAnchorKind,
): FormalFlowchartSide | null {
  if (!anchorId) return null;

  const suffix = `-${kind}-`;
  const index = anchorId.indexOf(suffix);
  if (index < 0) return null;

  const side = anchorId.slice(index + suffix.length).split("-")[0];
  return isFormalSide(side) ? side : null;
}

export function projectPointerToFormalShapeEdge(
  rect: FormalFlowchartRect,
  x: number,
  y: number,
  lockedSide?: FormalFlowchartSide | null,
): FormalFlowchartShapeEdgeProjection | null {
  if (rect.width <= 0 || rect.height <= 0) return null;

  const right = rect.left + rect.width;
  const bottom = rect.top + rect.height;

  const project = (
    side: FormalFlowchartSide,
  ): FormalFlowchartShapeEdgeProjection => {
    switch (side) {
      case "top": {
        const px = clamp(x, rect.left, right);
        return {
          side,
          x: px,
          y: rect.top,
          distance: (px - rect.left) / rect.width,
          distanceToEdge: Math.abs(y - rect.top),
        };
      }
      case "bottom": {
        const px = clamp(x, rect.left, right);
        return {
          side,
          x: px,
          y: bottom,
          distance: (px - rect.left) / rect.width,
          distanceToEdge: Math.abs(y - bottom),
        };
      }
      case "left": {
        const py = clamp(y, rect.top, bottom);
        return {
          side,
          x: rect.left,
          y: py,
          distance: (py - rect.top) / rect.height,
          distanceToEdge: Math.abs(x - rect.left),
        };
      }
      case "right": {
        const py = clamp(y, rect.top, bottom);
        return {
          side,
          x: right,
          y: py,
          distance: (py - rect.top) / rect.height,
          distanceToEdge: Math.abs(x - right),
        };
      }
    }
  };

  if (lockedSide) return project(lockedSide);

  let best: FormalFlowchartShapeEdgeProjection | null = null;
  for (const side of formalSides) {
    const candidate = project(side);
    if (!best || candidate.distanceToEdge < best.distanceToEdge) {
      best = candidate;
    }
  }

  return best;
}

export function pickFormalDiamondSideFromPointer(
  rect: FormalFlowchartRect,
  x: number,
  y: number,
): FormalFlowchartSide {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = x - cx;
  const dy = y - cy;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? "right" : "left";
  }

  return dy > 0 ? "bottom" : "top";
}

export function pickFormalSnapSideForPointer(
  rect: FormalFlowchartRect,
  x: number,
  y: number,
  options: {
    readonly oppositePoint?: DiagramPoint | null;
    readonly shapeIsDiamond?: boolean;
  } = {},
): FormalFlowchartSide {
  if (options.shapeIsDiamond) {
    return pickFormalDiamondSideFromPointer(rect, x, y);
  }

  const right = rect.left + rect.width;
  const bottom = rect.top + rect.height;
  const withinHorizontalSpan = x >= rect.left && x <= right;

  if (withinHorizontalSpan && y < rect.top) {
    if (isPointerNearHorizontalSide(rect, x, "left")) return "left";
    if (isPointerNearHorizontalSide(rect, x, "right")) return "right";
    return "top";
  }

  if (withinHorizontalSpan && y > bottom) {
    if (isPointerNearHorizontalSide(rect, x, "left")) return "left";
    if (isPointerNearHorizontalSide(rect, x, "right")) return "right";
    return "bottom";
  }

  const activeZones = formalSides.filter((side) =>
    isPointerInSideZone(rect, x, y, side),
  );
  if (activeZones.length === 1) return activeZones[0] as FormalFlowchartSide;
  if (activeZones.length > 1) {
    return resolveZoneSideOverlap(activeZones, rect, x, y);
  }

  if (options.oppositePoint) {
    return sideFacingOppositePoint(rect, options.oppositePoint);
  }

  return pickSideByQuadrant(rect, x, y);
}

export function resolveFormalConstrainedEdgeSnap(input: {
  readonly connectionId: string;
  readonly shape: FormalFlowchartRect;
  readonly x: number;
  readonly y: number;
  readonly kind: FormalFlowchartAnchorKind;
  readonly oppositePoint?: DiagramPoint | null;
  readonly shapeIsDiamond?: boolean;
}): FormalFlowchartEdgeSnapResult | null {
  const side = pickFormalSnapSideForPointer(input.shape, input.x, input.y, {
    ...(input.oppositePoint !== undefined
      ? { oppositePoint: input.oppositePoint }
      : {}),
    ...(input.shapeIsDiamond !== undefined
      ? { shapeIsDiamond: input.shapeIsDiamond }
      : {}),
  });

  if (input.shapeIsDiamond) {
    const point = formalPointOnShapeEdge(
      input.shape,
      side,
      DIAMOND_VERTEX_DISTANCE,
    );

    return {
      anchorId: buildFormalEdgeAnchorId(input.connectionId, input.kind, side),
      side,
      distance: DIAMOND_VERTEX_DISTANCE,
      distanceToEdge: Math.hypot(point.x - input.x, point.y - input.y),
      ratio: 1,
      x: point.x,
      y: point.y,
      hardSnapped: true,
    };
  }

  const projection = projectPointerToFormalShapeEdge(
    input.shape,
    input.x,
    input.y,
    side,
  );
  if (!projection) return null;

  return {
    anchorId: buildFormalEdgeAnchorId(
      input.connectionId,
      input.kind,
      projection.side,
    ),
    side: projection.side,
    distance: projection.distance,
    distanceToEdge: projection.distanceToEdge,
    ratio: 1,
    x: projection.x,
    y: projection.y,
    hardSnapped: true,
  };
}

export function buildFormalVisualConnectorAnchors(
  connectionId: string,
  fromRect: FormalFlowchartRect,
  toRect: FormalFlowchartRect,
  options: {
    readonly fromIsDiamond?: boolean;
    readonly toIsDiamond?: boolean;
  } = {},
): FormalFlowchartPathAnchor[] {
  const anchors: FormalFlowchartPathAnchor[] = [];
  const startSlots = options.fromIsDiamond
    ? [DIAMOND_VERTEX_DISTANCE]
    : VISUAL_ANCHOR_SLOT_DISTANCES;
  const endSlots = options.toIsDiamond
    ? [DIAMOND_VERTEX_DISTANCE]
    : VISUAL_ANCHOR_SLOT_DISTANCES;

  for (const side of formalSides) {
    for (const distance of startSlots) {
      const point = formalPointOnShapeEdge(fromRect, side, distance);
      anchors.push({
        id: `${connectionId}-start-${side}${
          options.fromIsDiamond ? "" : `-${distance}`
        }`,
        ...point,
        side,
        kind: "start",
      });
    }

    for (const distance of endSlots) {
      const point = formalPointOnShapeEdge(toRect, side, distance);
      anchors.push({
        id: `${connectionId}-end-${side}${
          options.toIsDiamond ? "" : `-${distance}`
        }`,
        ...point,
        side,
        kind: "end",
      });
    }
  }

  return anchors;
}

export function findNearestFormalAnchor(
  anchors: readonly FormalFlowchartPathAnchor[],
  x: number,
  y: number,
  kind: FormalFlowchartAnchorKind,
): {
  readonly anchor: FormalFlowchartPathAnchor;
  readonly distance: number;
} | null {
  let nearest: FormalFlowchartPathAnchor | null = null;
  let nearestDistance = Infinity;

  for (const anchor of anchors) {
    if (anchor.kind !== kind) continue;
    const distance = Math.hypot(anchor.x - x, anchor.y - y);

    if (distance < nearestDistance) {
      nearest = anchor;
      nearestDistance = distance;
    }
  }

  return nearest ? { anchor: nearest, distance: nearestDistance } : null;
}

export function resolveFormalAnchorSnap(input: {
  readonly anchors: readonly FormalFlowchartPathAnchor[];
  readonly x: number;
  readonly y: number;
  readonly kind: FormalFlowchartAnchorKind;
  readonly snapDistancePx: number;
  readonly releaseDistancePx: number;
  readonly lockedAnchorId?: string | null;
}): FormalFlowchartPathAnchor | null {
  const nearest = findNearestFormalAnchor(
    input.anchors,
    input.x,
    input.y,
    input.kind,
  );
  if (!nearest) return null;

  if (input.lockedAnchorId) {
    const locked = input.anchors.find(
      (anchor) =>
        anchor.id === input.lockedAnchorId && anchor.kind === input.kind,
    );
    if (!locked) return null;

    const lockedDistance = Math.hypot(locked.x - input.x, locked.y - input.y);
    if (lockedDistance <= input.releaseDistancePx) return locked;
  }

  return nearest.distance <= input.snapDistancePx ? nearest.anchor : null;
}

export function resolveFormalMagneticAnchorSnap(input: {
  readonly anchors: readonly FormalFlowchartPathAnchor[];
  readonly x: number;
  readonly y: number;
  readonly kind: FormalFlowchartAnchorKind;
  readonly snapDistancePx: number;
  readonly releaseDistancePx: number;
  readonly hardSnapDistancePx: number;
  readonly lockedAnchorId?: string | null;
}): FormalFlowchartMagneticSnapResult | null {
  const nearest = findNearestFormalAnchor(
    input.anchors,
    input.x,
    input.y,
    input.kind,
  );
  if (!nearest) return null;

  let target = nearest.anchor;
  let distance = nearest.distance;
  let activeDistance = input.snapDistancePx;

  if (input.lockedAnchorId) {
    const locked = input.anchors.find(
      (anchor) =>
        anchor.id === input.lockedAnchorId && anchor.kind === input.kind,
    );

    if (locked) {
      const lockedDistance = Math.hypot(locked.x - input.x, locked.y - input.y);

      if (lockedDistance <= input.releaseDistancePx) {
        target = locked;
        distance = lockedDistance;
        activeDistance = input.releaseDistancePx;
      }
    }
  }

  if (distance > activeDistance) return null;

  const hardSnapped = distance <= input.hardSnapDistancePx;
  const ratio = hardSnapped
    ? 1
    : smoothstep(1 - distance / Math.max(1, activeDistance));

  return {
    anchor: target,
    distance,
    ratio,
    x: hardSnapped ? target.x : interpolate(input.x, target.x, ratio),
    y: hardSnapped ? target.y : interpolate(input.y, target.y, ratio),
    hardSnapped,
  };
}

export function resolveFormalPreferredEndpointSnap(input: {
  readonly connectionId: string;
  readonly shape: FormalFlowchartRect;
  readonly anchors: readonly FormalFlowchartPathAnchor[];
  readonly x: number;
  readonly y: number;
  readonly kind: FormalFlowchartAnchorKind;
  readonly oppositePoint?: DiagramPoint | null;
  readonly shapeIsDiamond?: boolean;
  readonly snapDistancePx?: number;
  readonly hardSnapDistancePx?: number;
}): FormalFlowchartEdgeSnapResult | null {
  const snapDistancePx = input.snapDistancePx ?? 24;
  const hardSnapDistancePx = input.hardSnapDistancePx ?? 8;
  const edgeSnap = resolveFormalConstrainedEdgeSnap(input);
  if (!edgeSnap || input.shapeIsDiamond) return edgeSnap;

  const sideAnchors = input.anchors.filter(
    (anchor) => anchor.kind === input.kind && anchor.side === edgeSnap.side,
  );
  const centerAnchors = sideAnchors.filter(
    (anchor) =>
      Math.abs(
        formalDistanceOnShapeEdge(input.shape, anchor.side, anchor) - 0.5,
      ) < 0.02,
  );
  const ordered = [
    ...centerAnchors,
    ...sideAnchors.filter(
      (anchor) => !centerAnchors.some((center) => center.id === anchor.id),
    ),
  ];

  const magnetic = resolveFormalMagneticAnchorSnap({
    anchors: ordered,
    x: input.x,
    y: input.y,
    kind: input.kind,
    snapDistancePx,
    releaseDistancePx: snapDistancePx,
    hardSnapDistancePx,
  });

  const sideLength = formalSideLengthPx(input.shape, edgeSnap.side);
  const center = formalPointOnShapeEdge(input.shape, edgeSnap.side, 0.5);
  const preferCenter =
    Math.hypot(input.x - center.x, input.y - center.y) <= snapDistancePx;

  if (magnetic) {
    const pointerDistance = formalDistanceOnShapeEdge(
      input.shape,
      edgeSnap.side,
      {
        x: magnetic.x,
        y: magnetic.y,
      },
    );
    const anchorDistance = formalDistanceOnShapeEdge(
      input.shape,
      edgeSnap.side,
      magnetic.anchor,
    );
    const rawDistance = preferCenter
      ? 0.5
      : Math.abs(anchorDistance - 0.5) < 0.02
        ? 0.5
        : pointerDistance;
    const distance = preferCenter
      ? 0.5
      : formalSnapDistanceToCenter(rawDistance, sideLength);
    const point = formalPointOnShapeEdge(input.shape, edgeSnap.side, distance);

    return {
      ...edgeSnap,
      distance,
      x: point.x,
      y: point.y,
      ratio: magnetic.ratio,
      hardSnapped:
        magnetic.hardSnapped || preferCenter || Math.abs(distance - 0.5) < 0.02,
    };
  }

  const distance = preferCenter
    ? 0.5
    : formalSnapDistanceToCenter(edgeSnap.distance, sideLength);
  const point = formalPointOnShapeEdge(input.shape, edgeSnap.side, distance);

  return {
    ...edgeSnap,
    distance,
    x: point.x,
    y: point.y,
    hardSnapped:
      edgeSnap.hardSnapped || preferCenter || Math.abs(distance - 0.5) < 0.02,
  };
}

const formalSides: readonly FormalFlowchartSide[] = [
  "top",
  "right",
  "bottom",
  "left",
];

function isFormalSide(value: string | undefined): value is FormalFlowchartSide {
  return formalSides.includes(value as FormalFlowchartSide);
}

function isPointerInSideZone(
  rect: FormalFlowchartRect,
  x: number,
  y: number,
  side: FormalFlowchartSide,
): boolean {
  const right = rect.left + rect.width;
  const bottom = rect.top + rect.height;
  const margin = EDGE_ZONE_MARGIN_PX;
  const zoneW = Math.min(rect.width * EDGE_ZONE_RATIO, rect.height * 0.75);
  const zoneH = Math.min(rect.height * EDGE_ZONE_RATIO, rect.width * 0.75);

  switch (side) {
    case "left":
      return (
        x >= rect.left - margin &&
        x <= rect.left + zoneW + margin &&
        y >= rect.top - margin &&
        y <= bottom + margin
      );
    case "right":
      return (
        x >= right - zoneW - margin &&
        x <= right + margin &&
        y >= rect.top - margin &&
        y <= bottom + margin
      );
    case "top":
      return (
        y >= rect.top - margin &&
        y <= rect.top + zoneH + margin &&
        x >= rect.left - margin &&
        x <= right + margin
      );
    case "bottom":
      return (
        y >= bottom - zoneH - margin &&
        y <= bottom + margin &&
        x >= rect.left - margin &&
        x <= right + margin
      );
  }
}

function isPointerNearHorizontalSide(
  rect: FormalFlowchartRect,
  x: number,
  side: "left" | "right",
): boolean {
  const right = rect.left + rect.width;
  const zoneW = Math.min(rect.width * EDGE_ZONE_RATIO, rect.height * 0.75);
  return side === "left" ? x <= rect.left + zoneW : x >= right - zoneW;
}

function sideFacingOppositePoint(
  rect: FormalFlowchartRect,
  oppositePoint: DiagramPoint,
): FormalFlowchartSide {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = oppositePoint.x - cx;
  const dy = oppositePoint.y - cy;
  const halfW = rect.width / 2 || 1;
  const halfH = rect.height / 2 || 1;

  if (Math.abs(dx) / halfW >= Math.abs(dy) / halfH) {
    return dx > 0 ? "right" : "left";
  }

  return dy > 0 ? "bottom" : "top";
}

function pickSideByQuadrant(
  rect: FormalFlowchartRect,
  x: number,
  y: number,
): FormalFlowchartSide {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = x - cx;
  const dy = y - cy;
  const halfW = rect.width / 2 || 1;
  const halfH = rect.height / 2 || 1;

  if (Math.abs(dx) / halfW >= Math.abs(dy) / halfH) {
    return dx < 0 ? "left" : "right";
  }

  return dy < 0 ? "top" : "bottom";
}

function resolveZoneSideOverlap(
  sides: readonly FormalFlowchartSide[],
  rect: FormalFlowchartRect,
  x: number,
  y: number,
): FormalFlowchartSide {
  return (
    [...sides]
      .map((side) => ({
        side,
        distance:
          projectPointerToFormalShapeEdge(rect, x, y, side)?.distanceToEdge ??
          Infinity,
      }))
      .sort((a, b) => a.distance - b.distance)[0]?.side ?? "top"
  );
}

function smoothstep(value: number): number {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - 2 * clamped);
}

function interpolate(from: number, to: number, ratio: number): number {
  return from + (to - from) * ratio;
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
