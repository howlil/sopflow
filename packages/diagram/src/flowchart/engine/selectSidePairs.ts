/**
 * Flowchart route candidate selection — v2 (simplified)
 *
 * Perubahan dari v1:
 * - Hanya 4 titik koneksi (top, right, bottom, left)
 * - Maksimum 4 kandidat per koneksi
 * - Distance selalu 0.5 (center point)
 * - Logika flat berdasarkan posisi relatif
 * - Tidak ada kombinasi diagonal sebagai default
 */

import type {
  FlowchartPortConstraint as PortConstraint,
  FlowchartRouteCandidate,
  FlowchartRouteConnection,
  FlowchartSide as Side,
  FlowchartUsedSides as UsedSides,
} from "./types.js";

export type {
  FlowchartSide as Side,
  FlowchartUsedSides as UsedSides,
} from "./types.js";

function isYaLabel(label: string | null | undefined): boolean {
  return /^(ya|yes|y)$/i.test((label ?? "").trim());
}

function isTidakLabel(label: string | null | undefined): boolean {
  return /^(tidak|no|n)$/i.test((label ?? "").trim());
}

export type FlowchartConnectionForSidePairs = FlowchartRouteConnection;

export interface ElemPos {
  left: number
  top: number
  width: number
  height: number
  right: number
  bottom: number
}

export type { FlowchartRouteCandidate };

/* ── Constants ────────────────────────────────────────────────── */

const DEFAULT_JETTY = 16
const LOOPBACK_JETTY = 24
const OPC_JETTY = 18

/* ── Port helpers ─────────────────────────────────────────────── */

function makeSourcePort(side: Side): PortConstraint {
  const map = { top: "north", bottom: "south", left: "west", right: "east" } as const
  return { portConstraint: map[side], exitX: 0.5, exitY: 0.5 }
}

function makeTargetPort(side: Side): PortConstraint {
  const map = { top: "north", bottom: "south", left: "west", right: "east" } as const
  return { portConstraint: map[side], entryX: 0.5, entryY: 0.5 }
}

function makeCandidate(
  sSide: Side,
  eSide: Side,
  overrides: Partial<FlowchartRouteCandidate> = {},
): FlowchartRouteCandidate {
  return {
    sSide,
    eSide,
    sourcePort: makeSourcePort(sSide),
    targetPort: makeTargetPort(eSide),
    jettySize: DEFAULT_JETTY,
    preferSimple: true,
    ...overrides,
  }
}

/**
 * Select preferred route candidates for flowchart connectors.
 *
 * Aturan:
 * - target di bawah       → bottom→top (primary), fallback kanan/kiri
 * - target di atas        → top→bottom, fallback kanan/kiri (loop-back)
 * - target di kanan       → bottom→left atau right→top (2 opsi)
 * - target di kiri        → bottom→right atau left→top (2 opsi)
 * - decision "Ya"         → bottom→top/left/right sesuai posisi
 * - decision "Tidak"      → side horizontal (right/left) → top
 */
export function selectSidePairs(
  conn: FlowchartConnectionForSidePairs,
  from: ElemPos,
  to: ElemPos,
  usedSides: UsedSides,
  _reservedSides: Map<string, Set<string>> | undefined,
  _toId: string,
  _connectionId: string,
): FlowchartRouteCandidate[] {
  const dx = (to.left + to.width / 2) - (from.left + from.width / 2)
  const dy = (to.top + to.height / 2) - (from.top + from.height / 2)

  const colThreshold = Math.max(from.width, to.width) * 0.5
  const sameCol = Math.abs(dx) < colThreshold
  const destRight = !sameCol && dx > 0
  const destLeft = !sameCol && dx < 0
  const destBelow = dy > 10
  const destAbove = dy < -10

  const isDecSrc = conn.sourceType === "flowchart-decision"
  const isStartTerminator = conn.sourceType === "flowchart-terminator"
  const isYa = isYaLabel(conn.label)
  const isTidak = isTidakLabel(conn.label)
  const isToOpc = conn.targetType === "flowchart-opc"
  const isFromOpc = conn.sourceType === "flowchart-opc"

  const srcOutBusy = (s: Side) =>
    (usedSides[conn.from]?.out?.[s] ?? []).some((id) => id !== conn.id)
  const dstInBusy = (s: Side) =>
    (usedSides[conn.to]?.in?.[s] ?? []).some((id) => id !== conn.id)

  const candidates: FlowchartRouteCandidate[] = []
  const push = (sSide: Side, eSide: Side, overrides: Partial<FlowchartRouteCandidate> = {}) => {
    candidates.push(makeCandidate(sSide, eSide, overrides))
  }

  /* ── OPC connections ─────────────────────────────────────── */
  if (isToOpc || isFromOpc) {
    push("bottom", "top", { jettySize: OPC_JETTY })
    if (destRight) push("right", "top", { jettySize: OPC_JETTY, preferSimple: false })
    else if (destLeft) push("left", "top", { jettySize: OPC_JETTY, preferSimple: false })
    push("bottom", "left", { jettySize: OPC_JETTY, preferSimple: false })
    push("bottom", "right", { jettySize: OPC_JETTY, preferSimple: false })
    return dedup(candidates)
  }

  /* ── Start terminator ────────────────────────────────────── */
  if (isStartTerminator) {
    push("bottom", "top")
    if (destRight && !srcOutBusy("right")) push("right", "top", { preferSimple: false })
    else if (destLeft && !srcOutBusy("left")) push("left", "top", { preferSimple: false })
    return dedup(candidates)
  }

  /* ── Decision source: Ya ─────────────────────────────────── */
  if (isDecSrc && isYa) {
    if (destBelow && sameCol) {
      push("bottom", "top", {
        sourcePort: { ...makeSourcePort("bottom"), exitX: 0.5 },
        targetPort: { ...makeTargetPort("top"), entryX: 0.5 },
      })
    } else if (destBelow && destRight) {
      push("bottom", "left", { preferSimple: false })
      push("right", "top", { preferSimple: false })
    } else if (destBelow && destLeft) {
      push("bottom", "right", { preferSimple: false })
      push("left", "top", { preferSimple: false })
    } else if (destAbove) {
      // `top` decision dipertahankan untuk panah masuk. Feedback keluar dari
      // sisi lateral agar tidak menumpuk pada connector sebelum decision.
      if (destLeft) {
        push("left", "left", { jettySize: LOOPBACK_JETTY, preferSimple: false })
        push("right", "right", { jettySize: LOOPBACK_JETTY, preferSimple: false })
      } else {
        push("right", "right", { jettySize: LOOPBACK_JETTY, preferSimple: false })
        push("left", "left", { jettySize: LOOPBACK_JETTY, preferSimple: false })
      }
    } else {
      push("bottom", "top")
    }
    push("bottom", "top")
    push("right", "left")
    return dedup(candidates)
  }

  /* ── Decision source: Tidak (loop-back horizontal) ───────── */
  if (isDecSrc && isTidak) {
    if (destAbove && !sameCol) {
      if (destLeft) {
        if (!srcOutBusy("left") && !dstInBusy("left")) push("left", "left", { jettySize: LOOPBACK_JETTY, preferSimple: false })
        if (!srcOutBusy("right") && !dstInBusy("right")) push("right", "right", { jettySize: LOOPBACK_JETTY, preferSimple: false })
      } else {
        if (!srcOutBusy("right") && !dstInBusy("right")) push("right", "right", { jettySize: LOOPBACK_JETTY, preferSimple: false })
        if (!srcOutBusy("left") && !dstInBusy("left")) push("left", "left", { jettySize: LOOPBACK_JETTY, preferSimple: false })
      }
    } else if (destAbove && sameCol) {
      if (!srcOutBusy("right") && !dstInBusy("right")) push("right", "right", { jettySize: LOOPBACK_JETTY, preferSimple: false })
      if (!srcOutBusy("left") && !dstInBusy("left")) push("left", "left", { jettySize: LOOPBACK_JETTY, preferSimple: false })
    } else if (destRight) {
      push("right", "top", { preferSimple: false })
      push("bottom", "left", { preferSimple: false })
    } else if (destLeft) {
      push("left", "top", { preferSimple: false })
      push("bottom", "right", { preferSimple: false })
    } else if (destBelow) {
      // `bottom` decision dipakai branch Ya. Tidak mencoba sisi lateral lebih
      // dulu agar dua label tidak berbagi jetty vertikal yang sama.
      if (!srcOutBusy("right")) push("right", "top", { preferSimple: false })
      if (!srcOutBusy("left")) push("left", "top", { preferSimple: false })
      push("bottom", "top", { preferSimple: false })
    } else {
      push("right", "top", { preferSimple: false })
      push("left", "top", { preferSimple: false })
    }
    push("bottom", "top")
    push("right", "left")
    return dedup(candidates)
  }

  /* ── Target above (loop-back) ────────────────────────────── */
  if (destAbove) {
    if (sameCol) {
      if (!srcOutBusy("right") && !dstInBusy("right"))
        push("right", "right", { jettySize: LOOPBACK_JETTY, preferSimple: false })
      if (!srcOutBusy("left") && !dstInBusy("left"))
        push("left", "left", { jettySize: LOOPBACK_JETTY, preferSimple: false })
      push("top", "bottom", { preferSimple: false })
    } else if (destRight) {
      push("right", "right", { jettySize: LOOPBACK_JETTY, preferSimple: false })
      push("left", "left", { jettySize: LOOPBACK_JETTY, preferSimple: false })
      push("right", "bottom", { preferSimple: false })
      push("top", "left", { preferSimple: false })
    } else {
      push("left", "left", { jettySize: LOOPBACK_JETTY, preferSimple: false })
      push("right", "right", { jettySize: LOOPBACK_JETTY, preferSimple: false })
      push("left", "bottom", { preferSimple: false })
      push("top", "right", { preferSimple: false })
    }
    push("bottom", "top")
    push("right", "left")
    return dedup(candidates)
  }

  /* ── Same column, target below ───────────────────────────── */
  if (sameCol && destBelow) {
    push("bottom", "top", {
      preferSimple: true,
      sourcePort: { ...makeSourcePort("bottom"), exitX: 0.5 },
      targetPort: { ...makeTargetPort("top"), entryX: 0.5 },
    })
    if (srcOutBusy("bottom") || dstInBusy("top")) {
      if (!srcOutBusy("right")) push("right", "top", { preferSimple: false })
      if (!srcOutBusy("left")) push("left", "top", { preferSimple: false })
    }
    push("bottom", "top")
    return dedup(candidates)
  }

  /* ── Target right ────────────────────────────────────────── */
  if (destRight) {
    push("bottom", "left")
    push("right", "top", { preferSimple: false })
    push("bottom", "top")
    push("right", "left")
    return dedup(candidates)
  }

  /* ── Target left ─────────────────────────────────────────── */
  if (destLeft) {
    push("bottom", "right")
    push("left", "top", { preferSimple: false })
    push("bottom", "top")
    push("left", "right")
    return dedup(candidates)
  }

  /* ── Fallback ─────────────────────────────────────────────── */
  push("bottom", "top")
  push("right", "left")
  push("bottom", "left")
  push("top", "bottom")
  return dedup(candidates)
}

/* ── Dedup helper ─────────────────────────────────────────────── */

function dedup(candidates: FlowchartRouteCandidate[]): FlowchartRouteCandidate[] {
  const seen = new Set<string>()
  return candidates.filter(({ sSide, eSide }) => {
    const k = `${sSide}-${eSide}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
