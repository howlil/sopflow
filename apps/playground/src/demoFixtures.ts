import type { SOPDocument } from "@sopflow/core";
import type { SopHeaderValue } from "@sopflow/react";

/**
 * Public playground's default: a complete SOP-AP workflow.
 *
 * Each step has exactly one actor. The decision has distinct outcomes and
 * all required SOP-AP field values are populated, so this is an example of
 * a ready document rather than a misleading invalid draft.
 */
export const demoDocument: SOPDocument = {
  schemaVersion: "1",
  id: "demo-document-approval",
  title: "Pengajuan dan Verifikasi Dokumen",
  actors: [
    { id: "staff", name: "Staff" },
    { id: "manager", name: "Manager" },
    { id: "admin", name: "Admin" },
  ],
  presentationOrder: ["start", "submit", "review", "archive", "end"],
  steps: [
    {
      id: "start",
      type: "start",
      name: "Mulai",
      actorIds: ["staff"],
      input: "Kebutuhan pengajuan dokumen",
      duration: { value: 0, unit: "minute" },
      output: "Proses pengajuan dimulai",
      note: "Staff menyiapkan dokumen sesuai kebutuhan.",
      next: "submit",
    },
    {
      id: "submit",
      type: "task",
      name: "Ajukan dokumen",
      actorIds: ["staff"],
      input: "Formulir pengajuan dan dokumen pendukung",
      duration: { value: 15, unit: "minute" },
      output: "Berkas pengajuan diterima",
      note: "Lengkapi seluruh lampiran sebelum diserahkan.",
      next: "review",
    },
    {
      id: "review",
      type: "decision",
      name: "Dokumen valid?",
      actorIds: ["manager"],
      input: "Berkas pengajuan dan daftar pemeriksaan",
      duration: { value: 10, unit: "minute" },
      output: "Keputusan verifikasi dokumen",
      note: "Tidak: perbaiki dan ajukan kembali. Ya: lanjutkan pengarsipan.",
      yes: "archive",
      no: "submit",
    },
    {
      id: "archive",
      type: "task",
      name: "Arsipkan dokumen",
      actorIds: ["admin"],
      input: "Dokumen yang telah diverifikasi",
      duration: { value: 5, unit: "minute" },
      output: "Dokumen tercatat dalam arsip",
      note: "Simpan dokumen sesuai aturan retensi internal.",
      next: "end",
    },
    {
      id: "end",
      type: "end",
      name: "Selesai",
      actorIds: ["admin"],
      input: "Bukti pencatatan dokumen",
      duration: { value: 0, unit: "minute" },
      output: "Proses pengajuan ditutup",
      note: "Dokumen dapat ditemukan kembali melalui daftar arsip.",
    },
  ],
};

export const demoHeader: SopHeaderValue = {
  number: "SOP/DEMO/001",
  institutionName: "SOPFlow Demo",
  createdDate: "2026-10-21",
  revisionDate: "2026-10-21",
  effectiveDate: "2026-10-21",
  lawBasis: ["Kebijakan internal pengelolaan dokumen (data contoh)"],
  qualifications: ["Petugas administrasi dan verifikator dokumen"],
  relatedSops: ["Prosedur pengarsipan dokumen"],
  equipment: ["Formulir pengajuan, komputer, dan penyimpanan arsip"],
  warnings: ["Dokumen tidak lengkap dikembalikan untuk diperbaiki."],
  records: ["Daftar pengajuan dan register arsip dokumen"],
  signatory: {
    name: "Penanggung Jawab SOP",
    role: "Manajer Administrasi",
  },
};

/** Intentionally invalid in TWO specific, fixable places for Problems UX. */
export const validationDocument: SOPDocument = {
  ...demoDocument,
  id: "demo-document-validation",
  steps: demoDocument.steps.map((step) =>
    step.id === "submit" ? { ...step, input: "" } : step,
  ),
};

export const validationHeader: SopHeaderValue = {
  ...demoHeader,
  lawBasis: [],
};

/** ?scenario=issues is for manual testing; ?unified-regression for CI. */
export function isValidationScenario(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.has("unified-regression") || params.get("scenario") === "issues";
}
