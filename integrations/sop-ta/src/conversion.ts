import type { ActorId, Duration, Step } from "@sopflow/core";
import type { SopTaDurationUnit, SopTaProcedureRow, SopTaStepType } from "./types.js";

const SOP_TA_TO_DURATION: Readonly<Record<SopTaDurationUnit, Duration["unit"]>> = {
  m: "minute",
  h: "hour",
  d: "day",
  w: "week",
  mo: "month",
  y: "year",
};

export const DURATION_TO_SOP_TA: Readonly<Record<Duration["unit"], SopTaDurationUnit>> = {
  minute: "m",
  hour: "h",
  day: "d",
  week: "w",
  month: "mo",
  year: "y",
};

export function resolveLegacyType(
  row: SopTaProcedureRow,
  index: number,
  total: number,
): Step["type"] {
  if (row.type === "decision") return "decision";
  if (row.type === "task") return "task";

  const inferred: SopTaStepType =
    row.type ?? (index === 0 || index === total - 1 ? "terminator" : "task");
  if (inferred !== "terminator") return "task";

  const role =
    row.terminatorRole ?? (index === 0 ? "start" : index === total - 1 ? "end" : null);
  if (!role) {
    throw new Error(
      `Terminator row "${row.id}" must be first, last, or provide terminatorRole`,
    );
  }
  return role;
}

export function resolveActorIds(row: SopTaProcedureRow): ActorId[] {
  if (row.pelaksanaIds?.length) return [...new Set(row.pelaksanaIds)];
  if (row.pelaksana?.trim()) return [row.pelaksana.trim()];

  const mapped = Object.entries(row.pelaksanaMapping ?? {}).find(
    ([, value]) => value.trim().length > 0,
  )?.[0];
  return mapped ? [mapped] : [];
}

export function toDuration(row: SopTaProcedureRow): Duration | undefined {
  if (!Number.isFinite(row.waktu)) return undefined;
  const unit = normalizeSopTaUnit(row.satuanWaktu);
  return unit ? { value: Math.max(0, row.waktu ?? 0), unit } : undefined;
}

export function normalizeSopTaUnit(value: string | undefined): Duration["unit"] | undefined {
  if (!value) return undefined;
  return SOP_TA_TO_DURATION[value as SopTaDurationUnit];
}
