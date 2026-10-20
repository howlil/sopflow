import { describe, expect, it } from "vitest";
import {
  exportSopTaDocument,
  exportSopTaPatchItems,
  importSopTaDocument,
  tryImportSopTaDocument,
  validateSopTaCompatibility,
  type SopTaProcedureRow,
} from "../src/index.js";

const rows: SopTaProcedureRow[] = [
  {
    id: "start",
    urutan: 1,
    kegiatan: "Mulai",
    pelaksana: "staff",
    type: "terminator",
    terminatorRole: "start",
    kelengkapan: "-",
    waktu: 1,
    satuanWaktu: "m",
    keluaran: "-",
    keterangan: "-",
  },
  {
    id: "review",
    urutan: 2,
    kegiatan: "Valid?",
    pelaksana: "manager",
    type: "decision",
    id_next_step_if_yes: "end",
    id_next_step_if_no: "fix",
    kelengkapan: "Berkas",
    waktu: 10,
    satuanWaktu: "m",
    keluaran: "Hasil review",
    keterangan: "-",
  },
  {
    id: "fix",
    urutan: 3,
    kegiatan: "Perbaiki",
    pelaksana: "staff",
    type: "task",
    kelengkapan: "Catatan",
    waktu: 1,
    satuanWaktu: "h",
    keluaran: "Perbaikan",
    keterangan: "-",
  },
  {
    id: "end",
    urutan: 4,
    kegiatan: "Selesai",
    pelaksana: "manager",
    type: "terminator" as const,
    terminatorRole: "end",
    kelengkapan: "-",
    waktu: 1,
    satuanWaktu: "m",
    keluaran: "-",
    keterangan: "-",
  },
];

describe("sop-ta compatibility adapter", () => {

  it("rejects unknown legacy actors instead of silently dropping references", () => {
    const result = tryImportSopTaDocument({
      id: "legacy",
      title: "Legacy SOP",
      actors: [{ id: "staff", name: "Staff" }, { id: "manager", name: "Manager" }],
      rows: rows.map((row) =>
        row.id === "fix" ? { ...row, pelaksana: "missing-actor" } : row,
      ),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ code: "UNKNOWN_ACTOR", rowId: "fix" }),
      );
    }
  });

  it("rejects missing units instead of silently dropping duration values", () => {
    const result = tryImportSopTaDocument({
      id: "legacy",
      title: "Legacy SOP",
      actors: [{ id: "staff", name: "Staff" }, { id: "manager", name: "Manager" }],
      rows: rows.map((row) => {
        if (row.id !== "fix") return row;
        const { satuanWaktu: _unit, ...withoutUnit } = row;
        return withoutUnit;
      }),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ code: "UNKNOWN_DURATION_UNIT", rowId: "fix" }),
      );
    }
  });

  it("rejects negative durations before lossy normalization", () => {
    const result = tryImportSopTaDocument({
      id: "legacy",
      title: "Legacy SOP",
      actors: [{ id: "staff", name: "Staff" }, { id: "manager", name: "Manager" }],
      rows: rows.map((row) => row.id === "fix" ? { ...row, waktu: -2 } : row),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ code: "INVALID_DURATION", rowId: "fix" }),
      );
    }
  });

  it("rejects conflicting actor sources in strict import", () => {
    const result = tryImportSopTaDocument({
      id: "legacy",
      title: "Legacy SOP",
      actors: [{ id: "staff", name: "Staff" }, { id: "manager", name: "Manager" }],
      rows: rows.map((row) =>
        row.id === "fix" ? { ...row, pelaksanaIds: ["manager"] } : row,
      ),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ code: "ACTOR_REPRESENTATION_CONFLICT", rowId: "fix" }),
      );
    }
  });

  it("rejects multi-actor legacy rows in strict SOP-AP import without discarding IDs", () => {
    const input = {
      id: "legacy",
      title: "Legacy SOP",
      actors: [{ id: "staff", name: "Staff" }, { id: "manager", name: "Manager" }],
      rows: rows.map((row) => {
        if (row.id !== "fix") return row;
        const { pelaksana: _pelaksana, ...rest } = row;
        return { ...rest, pelaksanaIds: ["staff", "manager"] };
      }),
    };
    const strict = tryImportSopTaDocument(input);
    expect(strict.success).toBe(false);
    if (!strict.success) {
      expect(strict.issues).toContainEqual(
        expect.objectContaining({ code: "INVALID_ACTOR_COUNT", rowId: "fix" }),
      );
    }

    // The legacy API remains lossless for existing consumers and can be
    // repaired explicitly instead of dropping the second actor.
    const legacy = importSopTaDocument(input);
    expect(legacy.steps.find((step) => step.id === "fix")?.actorIds).toEqual([
      "staff", "manager",
    ]);
    expect(() => exportSopTaPatchItems(legacy)).toThrow(/not losslessly compatible/i);
  });

  it("rejects duplicate explicit pelaksanaIds before legacy normalization", () => {
    const result = tryImportSopTaDocument({
      id: "legacy",
      title: "Legacy SOP",
      actors: [
        { id: "staff", name: "Staff" },
        { id: "manager", name: "Manager" },
      ],
      rows: rows.map((row) =>
        row.id === "fix" ? { ...row, pelaksanaIds: ["staff", "staff"] } : row,
      ),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ code: "INVALID_ACTOR_COUNT", rowId: "fix" }),
      );
    }
  });

  it("rejects silently ignored branch fields in strict import", () => {
    const result = tryImportSopTaDocument({
      id: "legacy",
      title: "Legacy SOP",
      actors: [{ id: "staff", name: "Staff" }, { id: "manager", name: "Manager" }],
      rows: rows.map((row) =>
        row.id === "fix" ? { ...row, id_next_step_if_no: "start" } : row,
      ),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ code: "UNSUPPORTED_BRANCH_METADATA", rowId: "fix" }),
      );
    }
  });

  it("rejects orphaned duration units in strict import", () => {
    const result = tryImportSopTaDocument({
      id: "legacy",
      title: "Legacy SOP",
      actors: [{ id: "staff", name: "Staff" }, { id: "manager", name: "Manager" }],
      rows: rows.map((row) => {
        if (row.id !== "fix") return row;
        const { waktu: _unused, ...withoutDuration } = row;
        return { ...withoutDuration, satuanWaktu: "h" };
      }),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ code: "UNPAIRED_DURATION_UNIT", rowId: "fix" }),
      );
    }
  });

  it("imports authored order and explicit workflow semantics", () => {
    const document = importSopTaDocument({
      id: "legacy",
      title: "Legacy SOP",
      actors: [
        { id: "staff", name: "Staff" },
        { id: "manager", name: "Manager" },
      ],
      rows,
    });

    expect(document.presentationOrder).toEqual([
      "start",
      "review",
      "fix",
      "end",
    ]);
    expect(document.steps.find((step) => step.id === "review")).toMatchObject({
      type: "decision",
      yes: "end",
      no: "fix",
    });
    expect(document.steps.find((step) => step.id === "fix")).toMatchObject({
      type: "task",
      next: "end",
      duration: { value: 1, unit: "hour" },
    });
  });

  it("round-trips a compatible linear sop-ta document without losing quality fields", () => {
    const linearRows = rows.map<SopTaProcedureRow>((row) => {
      if (row.id !== "review") return row;
      const {
        id_next_step_if_yes: _yes,
        id_next_step_if_no: _no,
        ...rest
      } = row;
      return { ...rest, type: "task" };
    });
    const document = importSopTaDocument({
      id: "legacy",
      title: "Legacy SOP",
      actors: [
        { id: "staff", name: "Staff" },
        { id: "manager", name: "Manager" },
      ],
      rows: linearRows,
    });

    expect(validateSopTaCompatibility(document)).toEqual([]);
    expect(exportSopTaDocument(document)).toEqual(
      linearRows.map((row) => ({
        id: row.id,
        urutan: row.urutan,
        kegiatan: row.kegiatan,
        pelaksana: row.pelaksana,
        pelaksanaIds: [row.pelaksana],
        kelengkapan: row.kelengkapan,
        waktu: row.waktu,
        satuanWaktu: row.satuanWaktu,
        keluaran: row.keluaran,
        keterangan: row.keterangan,
        type: row.type,
        ...(row.terminatorRole
          ? { terminatorRole: row.terminatorRole }
          : {}),
      })),
    );
  });

  it("exports the exact sop-ta procedure patch shape", () => {
    const document = importSopTaDocument({
      id: "legacy",
      title: "Legacy SOP",
      actors: [
        { id: "staff", name: "Staff" },
        { id: "manager", name: "Manager" },
      ],
      rows,
    });

    expect(exportSopTaPatchItems(document)).toEqual([
      expect.objectContaining({
        tempId: "start",
        jenis: "AWAL_AKHIR",
        pelaksanaId: "staff",
      }),
      expect.objectContaining({
        tempId: "review",
        jenis: "KEPUTUSAN",
        pelaksanaId: "manager",
        langkahSelanjutnyaYaTempId: "end",
        langkahSelanjutnyaTidakTempId: "fix",
      }),
      expect.objectContaining({
        tempId: "fix",
        jenis: "KEGIATAN",
        pelaksanaId: "staff",
        waktu: 1,
        satuanWaktu: "h",
      }),
      expect.objectContaining({
        tempId: "end",
        jenis: "AWAL_AKHIR",
        pelaksanaId: "manager",
      }),
    ]);
  });

  it("rejects structurally invalid documents before export", () => {
    const valid = importSopTaDocument({
      id: "legacy", title: "Legacy SOP",
      actors: [{ id: "staff", name: "Staff" }, { id: "manager", name: "Manager" }],
      rows,
    });
    const invalid = { ...valid, actors: [{ id: "staff", name: "Staff" }] };
    expect(validateSopTaCompatibility(invalid)).toContainEqual(
      expect.objectContaining({ code: "INVALID_DOCUMENT" }),
    );
    expect(() => exportSopTaPatchItems(invalid)).toThrow(/not losslessly compatible/i);
  });

  it("rejects export when a generic task jumps outside authored sequence", () => {
    const imported = importSopTaDocument({
      id: "legacy",
      title: "Legacy SOP",
      actors: [
        { id: "staff", name: "Staff" },
        { id: "manager", name: "Manager" },
      ],
      rows,
    });
    const document = {
      ...imported,
      steps: imported.steps.map((step) =>
        step.id === "fix" && step.type === "task"
          ? { ...step, next: "review" }
          : step,
      ),
    };

    expect(validateSopTaCompatibility(document)).toContainEqual(
      expect.objectContaining({
        code: "NON_SEQUENTIAL_TASK",
        stepId: "fix",
      }),
    );
    expect(() => exportSopTaDocument(document)).toThrow(
      /not losslessly compatible/i,
    );
  });
});
