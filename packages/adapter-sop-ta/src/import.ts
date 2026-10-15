import { parseSop, type SOPDocument, type Step } from "@sopflow/core";
import type { SopTaImportInput } from "./types.js";
import { resolveLegacyType, resolveActorIds, toDuration, normalizeSopTaUnit } from "./conversion.js";

export interface SopTaImportIssue {
  readonly code:
    | "UNKNOWN_ACTOR"
    | "ACTOR_REPRESENTATION_CONFLICT"
    | "UNSUPPORTED_BRANCH_METADATA"
    | "UNPAIRED_DURATION_UNIT"
    | "AMBIGUOUS_ACTOR_MAPPING"
    | "INVALID_DURATION"
    | "UNKNOWN_DURATION_UNIT"
    | "IMPORT_FAILED";
  readonly rowId?: string;
  readonly message: string;
}

export type SopTaImportResult =
  | { readonly success: true; readonly document: SOPDocument }
  | { readonly success: false; readonly issues: readonly SopTaImportIssue[] };

/**
 * Strict import for boundaries that cannot silently discard legacy fields.
 * The existing importSopTaDocument is retained for backward compatibility.
 */
export function tryImportSopTaDocument(input: SopTaImportInput): SopTaImportResult {
  const issues: SopTaImportIssue[] = [];
  const knownActorIds = new Set(input.actors.map((actor) => actor.id));
  const orderedRows = [...input.rows].sort(
    (left, right) => left.urutan - right.urutan || left.id.localeCompare(right.id),
  );
  for (const [rowIndex, row] of orderedRows.entries()) {
    const explicitIds = row.pelaksanaIds?.length ? [...new Set(row.pelaksanaIds)] : [];
    const primaryId = row.pelaksana?.trim();
    const mappedIds = Object.entries(row.pelaksanaMapping ?? {})
      .filter(([, value]) => value.trim())
      .map(([actorId]) => actorId);
    if (
      (primaryId && explicitIds.length > 0 &&
        (explicitIds.length !== 1 || explicitIds[0] !== primaryId)) ||
      (mappedIds.length > 0 && (explicitIds.length > 0 || primaryId) &&
        (mappedIds.length !== 1 ||
          mappedIds[0] !== (explicitIds[0] ?? primaryId)))
    ) {
      issues.push({
        code: "ACTOR_REPRESENTATION_CONFLICT",
        rowId: row.id,
        message: `Row "${row.id}" supplies conflicting actor representations`,
      });
    }
    if (row.satuanWaktu !== undefined && row.waktu === undefined) {
      issues.push({
        code: "UNPAIRED_DURATION_UNIT",
        rowId: row.id,
        message: `Row "${row.id}" supplies a unit without a duration`,
      });
    }
    let effectiveType: Step["type"];
    try {
      effectiveType = resolveLegacyType(row, rowIndex, orderedRows.length);
    } catch (error) {
      issues.push({
        code: "IMPORT_FAILED",
        rowId: row.id,
        message: error instanceof Error ? error.message : "Invalid row type",
      });
      continue;
    }
    const nextRow = orderedRows[rowIndex + 1];
    const unsupportedBranch =
      (effectiveType !== "decision" && row.id_next_step_if_no !== undefined) ||
      (effectiveType === "start" && row.id_next_step_if_yes !== undefined &&
        row.id_next_step_if_yes !== nextRow?.id) ||
      (effectiveType === "end" && row.id_next_step_if_yes !== undefined) ||
      (effectiveType !== "start" && effectiveType !== "end" && row.terminatorRole !== undefined);
    if (unsupportedBranch) {
      issues.push({
        code: "UNSUPPORTED_BRANCH_METADATA",
        rowId: row.id,
        message: `Row "${row.id}" contains branch metadata the adapter cannot preserve`,
      });
    }
    for (const actorId of resolveActorIds(row)) {
      if (!knownActorIds.has(actorId)) {
        issues.push({
          code: "UNKNOWN_ACTOR",
          rowId: row.id,
          message: `Row "${row.id}" references unknown actor "${actorId}"`,
        });
      }
    }
    if (
      !row.pelaksanaIds?.length &&
      !row.pelaksana?.trim() &&
      Object.values(row.pelaksanaMapping ?? {}).filter((value) => value.trim()).length > 1
    ) {
      issues.push({
        code: "AMBIGUOUS_ACTOR_MAPPING",
        rowId: row.id,
        message: `Row "${row.id}" has multiple actor mappings`,
      });
    }
    if (row.waktu !== undefined && (!Number.isFinite(row.waktu) || row.waktu < 0)) {
      issues.push({
        code: "INVALID_DURATION",
        rowId: row.id,
        message: `Row "${row.id}" has invalid duration`,
      });
    }
    if (
      row.waktu !== undefined &&
      !normalizeSopTaUnit(row.satuanWaktu)
    ) {
      issues.push({
        code: "UNKNOWN_DURATION_UNIT",
        rowId: row.id,
        message: `Row "${row.id}" has unknown duration unit "${row.satuanWaktu}"`,
      });
    }
  }
  if (issues.length > 0) return { success: false, issues };

  try {
    const document = importSopTaDocument(input);
    const parsed = parseSop(document);
    if (!parsed.success) {
      return {
        success: false,
        issues: parsed.errors.map((message) => ({ code: "IMPORT_FAILED", message })),
      };
    }
    return { success: true, document: parsed.data };
  } catch (error) {
    return {
      success: false,
      issues: [{
        code: "IMPORT_FAILED",
        message: error instanceof Error ? error.message : "Legacy import failed",
      }],
    };
  }
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
