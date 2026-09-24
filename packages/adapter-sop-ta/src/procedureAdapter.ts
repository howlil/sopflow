import {
  getPresentationSteps,
  type ActorId,
  type Duration,
  type SOPDocument,
  type Step,
} from "@sopflow/core";
import type {
  SopTaDurationUnit,
  SopTaImportInput,
  SopTaProcedureRow,
  SopTaStepType,
} from "./types.js";

const SOP_TA_TO_DURATION: Readonly<Record<SopTaDurationUnit, Duration["unit"]>> = {
  m: "minute",
  h: "hour",
  d: "day",
  w: "week",
  mo: "month",
  y: "year",
};

const DURATION_TO_SOP_TA: Readonly<Record<Duration["unit"], SopTaDurationUnit>> = {
  minute: "m",
  hour: "h",
  day: "d",
  week: "w",
  month: "mo",
  year: "y",
};

export interface SopTaCompatibilityIssue {
  readonly code:
    | "EMPTY_PROCEDURE"
    | "AMBIGUOUS_TERMINATOR"
    | "MULTIPLE_ENDS"
    | "INVALID_START_POSITION"
    | "INVALID_END_POSITION"
    | "INVALID_ACTOR_COUNT"
    | "NON_SEQUENTIAL_TASK";
  readonly message: string;
  readonly stepId?: string;
}

export function importSopTaDocument(input: SopTaImportInput): SOPDocument {
  const rows = [...input.rows].sort(
    (left, right) => left.urutan - right.urutan || left.id.localeCompare(right.id),
  );
  if (rows.length < 2) {
    throw new Error("sop-ta import requires at least start and end procedure rows");
  }

  const actors = input.actors.map((actor) => ({ ...actor }));
  const knownActorIds = new Set(actors.map((actor) => actor.id));
  const presentationOrder = rows.map((row) => row.id);
  const steps = rows.map<Step>((row, index) => {
    const type = resolveLegacyType(row, index, rows.length);
    const actorIds = resolveActorIds(row).filter((actorId) =>
      knownActorIds.has(actorId),
    );
    const quality = {
      actorIds,
      ...(row.kelengkapan !== undefined ? { input: row.kelengkapan } : {}),
      ...(toDuration(row) ? { duration: toDuration(row) } : {}),
      ...(row.keluaran !== undefined ? { output: row.keluaran } : {}),
      ...(row.keterangan !== undefined ? { note: row.keterangan } : {}),
    };

    if (type === "start") {
      const next = rows[index + 1]?.id;
      if (!next) throw new Error(`Start row "${row.id}" has no next row`);
      return {
        id: row.id,
        type: "start",
        name: row.kegiatan,
        ...quality,
        next,
      };
    }

    if (type === "end") {
      return {
        id: row.id,
        type: "end",
        name: row.kegiatan,
        ...quality,
      };
    }

    if (type === "decision") {
      if (!row.id_next_step_if_yes || !row.id_next_step_if_no) {
        throw new Error(
          `Decision row "${row.id}" requires explicit Ya and Tidak targets`,
        );
      }
      return {
        id: row.id,
        type: "decision",
        name: row.kegiatan,
        ...quality,
        yes: row.id_next_step_if_yes,
        no: row.id_next_step_if_no,
      };
    }

    const next = row.id_next_step_if_yes ?? rows[index + 1]?.id;
    if (!next) throw new Error(`Task row "${row.id}" has no next row`);
    return {
      id: row.id,
      type: "task",
      name: row.kegiatan,
      ...quality,
      next,
    };
  });

  return {
    schemaVersion: "1",
    id: input.id,
    title: input.title,
    actors,
    steps,
    presentationOrder,
  };
}

export function validateSopTaCompatibility(
  document: SOPDocument,
): SopTaCompatibilityIssue[] {
  const ordered = getPresentationSteps(document);
  const issues: SopTaCompatibilityIssue[] = [];

  if (ordered.length < 2) {
    issues.push({
      code: "EMPTY_PROCEDURE",
      message: "sop-ta requires at least start and end procedure rows",
    });
    return issues;
  }

  const starts = ordered.filter((step) => step.type === "start");
  const ends = ordered.filter((step) => step.type === "end");

  if (starts.length !== 1 || starts[0]?.id !== ordered[0]?.id) {
    issues.push({
      code: "INVALID_START_POSITION",
      message: "sop-ta requires exactly one start row at the beginning",
      stepId: starts[0]?.id,
    });
  }

  if (ends.length !== 1) {
    issues.push({
      code: "MULTIPLE_ENDS",
      message: "sop-ta compatibility requires exactly one end row",
    });
  } else if (ends[0]?.id !== ordered.at(-1)?.id) {
    issues.push({
      code: "INVALID_END_POSITION",
      message: "sop-ta requires the end row to be last",
      stepId: ends[0]?.id,
    });
  }

  ordered.forEach((step, index) => {
    if (step.actorIds.length !== 1) {
      issues.push({
        code: "INVALID_ACTOR_COUNT",
        message: `Step "${step.id}" must have exactly one sop-ta pelaksana`,
        stepId: step.id,
      });
    }

    if (step.type === "start" || step.type === "task") {
      const expectedNext = ordered[index + 1]?.id;
      if (step.next !== expectedNext) {
        issues.push({
          code: "NON_SEQUENTIAL_TASK",
          message: `Step "${step.id}" cannot be exported losslessly because its next target is not the following authored row`,
          stepId: step.id,
        });
      }
    }
  });

  return issues;
}

export function exportSopTaDocument(
  document: SOPDocument,
): SopTaProcedureRow[] {
  const issues = validateSopTaCompatibility(document);
  if (issues.length > 0) {
    throw new Error(
      `SOP document is not losslessly compatible with sop-ta: ${issues
        .map((issue) => issue.message)
        .join("; ")}`,
    );
  }

  return getPresentationSteps(document).map((step, index, ordered) => {
    const common: SopTaProcedureRow = {
      id: step.id,
      urutan: index + 1,
      kegiatan: step.name,
      pelaksana: step.actorIds[0] as ActorId,
      pelaksanaIds: [...step.actorIds],
      ...(step.input !== undefined ? { kelengkapan: step.input } : {}),
      ...(step.duration !== undefined
        ? {
            waktu: step.duration.value,
            satuanWaktu: DURATION_TO_SOP_TA[step.duration.unit],
          }
        : {}),
      ...(step.output !== undefined ? { keluaran: step.output } : {}),
      ...(step.note !== undefined ? { keterangan: step.note } : {}),
    };

    if (step.type === "start") {
      return { ...common, type: "terminator", terminatorRole: "start" };
    }
    if (step.type === "end") {
      return { ...common, type: "terminator", terminatorRole: "end" };
    }
    if (step.type === "decision") {
      return {
        ...common,
        type: "decision",
        id_next_step_if_yes: step.yes,
        id_next_step_if_no: step.no,
      };
    }

    const next = ordered[index + 1];
    if (!next || step.next !== next.id) {
      throw new Error(`Task "${step.id}" is not sequential in authored order`);
    }
    return { ...common, type: "task" };
  });
}

function resolveLegacyType(
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

function resolveActorIds(row: SopTaProcedureRow): ActorId[] {
  if (row.pelaksanaIds?.length) return [...new Set(row.pelaksanaIds)];
  if (row.pelaksana?.trim()) return [row.pelaksana.trim()];

  const mapped = Object.entries(row.pelaksanaMapping ?? {}).find(
    ([, value]) => value.trim().length > 0,
  )?.[0];
  return mapped ? [mapped] : [];
}

function toDuration(row: SopTaProcedureRow): Duration | undefined {
  if (!Number.isFinite(row.waktu)) return undefined;
  const unit = normalizeSopTaUnit(row.satuanWaktu);
  return unit ? { value: Math.max(0, row.waktu ?? 0), unit } : undefined;
}

function normalizeSopTaUnit(value: string | undefined): Duration["unit"] | undefined {
  if (!value) return undefined;
  return SOP_TA_TO_DURATION[value as SopTaDurationUnit];
}
