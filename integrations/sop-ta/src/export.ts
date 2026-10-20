import { getPresentationSteps, type ActorId, type SOPDocument } from "@sopflow/core";
import type { SopTaProcedureRow, SopTaProcedurePatchItem } from "./types.js";
import { DURATION_TO_SOP_TA } from "./conversion.js";
import { validateSopTaCompatibility } from "./compatibility.js";

export function exportSopTaPatchItems(
  document: SOPDocument,
): SopTaProcedurePatchItem[] {
  const issues = validateSopTaCompatibility(document);
  if (issues.length > 0) {
    throw new Error(
      `SOP document is not losslessly compatible with sop-ta: ${issues
        .map((issue) => issue.message)
        .join("; ")}`,
    );
  }

  return getPresentationSteps(document).map((step) => ({
    tempId: step.id,
    jenis:
      step.type === "decision"
        ? "KEPUTUSAN"
        : step.type === "task"
          ? "KEGIATAN"
          : "AWAL_AKHIR",
    kegiatan: step.name,
    ...(step.input !== undefined ? { kelengkapan: step.input } : {}),
    ...(step.output !== undefined ? { keluaran: step.output } : {}),
    ...(step.duration !== undefined
      ? {
          waktu: step.duration.value,
          satuanWaktu: DURATION_TO_SOP_TA[step.duration.unit],
        }
      : {}),
    ...(step.note !== undefined ? { keterangan: step.note } : {}),
    ...(step.actorIds[0] ? { pelaksanaId: step.actorIds[0] } : {}),
    ...(step.type === "decision"
      ? {
          langkahSelanjutnyaYaTempId: step.yes,
          langkahSelanjutnyaTidakTempId: step.no,
        }
      : {}),
  }));
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
