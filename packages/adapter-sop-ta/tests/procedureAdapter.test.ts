import { describe, expect, it } from "vitest";
import {
  exportSopTaDocument,
  importSopTaDocument,
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
