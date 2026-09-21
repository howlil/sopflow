import type {
  FormalFlowchartRect,
  FormalFlowchartRouteCandidate,
  FormalFlowchartSide,
} from "./types.js";

export interface FormalFlowchartSideUsage {
  readonly in?: Partial<Record<FormalFlowchartSide, readonly string[]>>;
  readonly out?: Partial<Record<FormalFlowchartSide, readonly string[]>>;
}

export type FormalFlowchartUsedSides = Readonly<
  Record<string, FormalFlowchartSideUsage>
>;

export interface FormalFlowchartConnectionMeta {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly label?: string | null;
  readonly sourceType?:
    | "flowchart-terminator"
    | "flowchart-process"
    | "flowchart-decision";
  readonly targetType?:
    | "flowchart-terminator"
    | "flowchart-process"
    | "flowchart-decision";
}

const DEFAULT_JETTY = 16;
const LOOPBACK_JETTY = 24;

function center(rect: FormalFlowchartRect): { x: number; y: number } {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function isYes(label: string | null | undefined): boolean {
  return label?.trim().toLocaleLowerCase("id") === "ya";
}

function isNo(label: string | null | undefined): boolean {
  return label?.trim().toLocaleLowerCase("id") === "tidak";
}

function candidate(
  sourceSide: FormalFlowchartSide,
  targetSide: FormalFlowchartSide,
  overrides: Partial<FormalFlowchartRouteCandidate> = {},
): FormalFlowchartRouteCandidate {
  return {
    sourceSide,
    targetSide,
    jettySize: DEFAULT_JETTY,
    preferSimple: true,
    ...overrides,
  };
}

export function selectFormalFlowchartSidePairs(
  connection: FormalFlowchartConnectionMeta,
  source: FormalFlowchartRect,
  target: FormalFlowchartRect,
  usedSides: FormalFlowchartUsedSides,
): FormalFlowchartRouteCandidate[] {
  const sourceCenter = center(source);
  const targetCenter = center(target);
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;

  const columnThreshold = Math.max(source.width, target.width) * 0.5;
  const sameColumn = Math.abs(dx) < columnThreshold;
  const targetRight = !sameColumn && dx > 0;
  const targetLeft = !sameColumn && dx < 0;
  const targetBelow = dy > 10;
  const targetAbove = dy < -10;

  const decisionSource = connection.sourceType === "flowchart-decision";
  const startTerminator = connection.sourceType === "flowchart-terminator";
  const yes = isYes(connection.label);
  const no = isNo(connection.label);

  const sourceBusy = (side: FormalFlowchartSide) =>
    (usedSides[connection.from]?.out?.[side] ?? []).some(
      (id) => id !== connection.id,
    );
  const targetBusy = (side: FormalFlowchartSide) =>
    (usedSides[connection.to]?.in?.[side] ?? []).some(
      (id) => id !== connection.id,
    );

  const candidates: FormalFlowchartRouteCandidate[] = [];
  const push = (
    sourceSide: FormalFlowchartSide,
    targetSide: FormalFlowchartSide,
    overrides: Partial<FormalFlowchartRouteCandidate> = {},
  ) => {
    candidates.push(candidate(sourceSide, targetSide, overrides));
  };

  if (startTerminator) {
    push("bottom", "top");
    if (targetRight && !sourceBusy("right")) {
      push("right", "top", { preferSimple: false });
    } else if (targetLeft && !sourceBusy("left")) {
      push("left", "top", { preferSimple: false });
    }
    return dedupe(candidates);
  }

  if (decisionSource && yes) {
    if (targetBelow && sameColumn) {
      push("bottom", "top");
    } else if (targetBelow && targetRight) {
      push("bottom", "left", { preferSimple: false });
      push("right", "top", { preferSimple: false });
    } else if (targetBelow && targetLeft) {
      push("bottom", "right", { preferSimple: false });
      push("left", "top", { preferSimple: false });
    } else if (targetAbove) {
      if (targetLeft) {
        push("left", "left", {
          jettySize: LOOPBACK_JETTY,
          preferSimple: false,
        });
        push("right", "right", {
          jettySize: LOOPBACK_JETTY,
          preferSimple: false,
        });
      } else {
        push("right", "right", {
          jettySize: LOOPBACK_JETTY,
          preferSimple: false,
        });
        push("left", "left", {
          jettySize: LOOPBACK_JETTY,
          preferSimple: false,
        });
      }
    } else {
      push("bottom", "top");
    }

    push("bottom", "top");
    push("right", "left");
    return dedupe(candidates);
  }

  if (decisionSource && no) {
    if (targetAbove && !sameColumn) {
      if (targetLeft) {
        if (!sourceBusy("left") && !targetBusy("left")) {
          push("left", "left", {
            jettySize: LOOPBACK_JETTY,
            preferSimple: false,
          });
        }
        if (!sourceBusy("right") && !targetBusy("right")) {
          push("right", "right", {
            jettySize: LOOPBACK_JETTY,
            preferSimple: false,
          });
        }
      } else {
        if (!sourceBusy("right") && !targetBusy("right")) {
          push("right", "right", {
            jettySize: LOOPBACK_JETTY,
            preferSimple: false,
          });
        }
        if (!sourceBusy("left") && !targetBusy("left")) {
          push("left", "left", {
            jettySize: LOOPBACK_JETTY,
            preferSimple: false,
          });
        }
      }
    } else if (targetAbove && sameColumn) {
      if (!sourceBusy("right") && !targetBusy("right")) {
        push("right", "right", {
          jettySize: LOOPBACK_JETTY,
          preferSimple: false,
        });
      }
      if (!sourceBusy("left") && !targetBusy("left")) {
        push("left", "left", {
          jettySize: LOOPBACK_JETTY,
          preferSimple: false,
        });
      }
    } else if (targetRight) {
      push("right", "top", { preferSimple: false });
      push("bottom", "left", { preferSimple: false });
    } else if (targetLeft) {
      push("left", "top", { preferSimple: false });
      push("bottom", "right", { preferSimple: false });
    } else if (targetBelow) {
      if (!sourceBusy("right")) {
        push("right", "top", { preferSimple: false });
      }
      if (!sourceBusy("left")) {
        push("left", "top", { preferSimple: false });
      }
      push("bottom", "top", { preferSimple: false });
    } else {
      push("right", "top", { preferSimple: false });
      push("left", "top", { preferSimple: false });
    }

    push("bottom", "top");
    push("right", "left");
    return dedupe(candidates);
  }

  if (targetAbove) {
    if (sameColumn) {
      if (!sourceBusy("right") && !targetBusy("right")) {
        push("right", "right", {
          jettySize: LOOPBACK_JETTY,
          preferSimple: false,
        });
      }
      if (!sourceBusy("left") && !targetBusy("left")) {
        push("left", "left", {
          jettySize: LOOPBACK_JETTY,
          preferSimple: false,
        });
      }
      push("top", "bottom", { preferSimple: false });
    } else if (targetRight) {
      push("right", "right", {
        jettySize: LOOPBACK_JETTY,
        preferSimple: false,
      });
      push("left", "left", {
        jettySize: LOOPBACK_JETTY,
        preferSimple: false,
      });
      push("right", "bottom", { preferSimple: false });
      push("top", "left", { preferSimple: false });
    } else {
      push("left", "left", {
        jettySize: LOOPBACK_JETTY,
        preferSimple: false,
      });
      push("right", "right", {
        jettySize: LOOPBACK_JETTY,
        preferSimple: false,
      });
      push("left", "bottom", { preferSimple: false });
      push("top", "right", { preferSimple: false });
    }

    push("bottom", "top");
    push("right", "left");
    return dedupe(candidates);
  }

  if (sameColumn && targetBelow) {
    push("bottom", "top");

    if (sourceBusy("bottom") || targetBusy("top")) {
      if (!sourceBusy("right")) push("right", "top", { preferSimple: false });
      if (!sourceBusy("left")) push("left", "top", { preferSimple: false });
    }

    push("bottom", "top");
    return dedupe(candidates);
  }

  if (targetRight) {
    push("bottom", "left");
    push("right", "top", { preferSimple: false });
    push("bottom", "top");
    push("right", "left");
    return dedupe(candidates);
  }

  if (targetLeft) {
    push("bottom", "right");
    push("left", "top", { preferSimple: false });
    push("bottom", "top");
    push("left", "right");
    return dedupe(candidates);
  }

  push("bottom", "top");
  push("right", "left");
  push("bottom", "left");
  push("top", "bottom");
  return dedupe(candidates);
}

function dedupe(
  candidates: readonly FormalFlowchartRouteCandidate[],
): FormalFlowchartRouteCandidate[] {
  const seen = new Set<string>();

  return candidates.filter((item) => {
    const key = `${item.sourceSide}-${item.targetSide}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
