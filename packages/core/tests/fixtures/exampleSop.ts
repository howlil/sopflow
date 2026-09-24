import type { SOPDocument } from "../../src/types.js";

export const exampleSop: SOPDocument = {
  schemaVersion: "1",

  id: "pengajuan-surat",
  title: "Pengajuan Surat",

  presentationOrder: [
    "start",
    "prepare-document",
    "check-document",
    "approve-document",
    "end",
  ],

  actors: [
    {
      id: "staff",
      name: "Staff",
    },
    {
      id: "manager",
      name: "Manager",
    },
  ],

  steps: [
    {
      id: "start",
      type: "start",
      name: "Mulai",
      actorIds: ["staff"],
      next: "prepare-document",
    },

    {
      id: "prepare-document",
      type: "task",
      name: "Prepare Document",
      actorIds: ["staff"],

      input: "Data pengajuan",
      duration: {
        value: 10,
        unit: "minute",
      },
      output: "Dokumen pengajuan",
      note: "",

      next: "check-document",
    },

    {
      id: "check-document",
      type: "decision",
      name: "Dokumen lengkap?",
      actorIds: ["manager"],

      input: "Dokumen pengajuan",
      duration: {
        value: 5,
        unit: "minute",
      },
      output: "Hasil pemeriksaan",

      yes: "approve-document",
      no: "prepare-document",
    },

    {
      id: "approve-document",
      type: "task",
      name: "Menyetujui dokumen",
      actorIds: ["manager"],

      input: "Dokumen lengkap",
      duration: {
        value: 5,
        unit: "minute",
      },
      output: "Dokumen disetujui",

      next: "end",
    },

    {
      id: "end",
      type: "end",
      name: "Selesai",
      actorIds: ["manager"],
    },
  ],
};
