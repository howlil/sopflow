import { useMemo, useState } from "react";
import type { SOPDocument } from "@sopflow/core";
import { buildDiagram } from "@sopflow/diagram";
import { SopUnifiedWorkspace, type SopHeaderValue } from "@sopflow/react";
import "@sopflow/react/styles.css";

const smokeDocument: SOPDocument = {
  schemaVersion: "1",
  id: "demo",
  title: "Pengajuan Dokumen",
  actors: [
    { id: "staff", name: "Staff" },
    { id: "manager", name: "Manager" },
    { id: "admin", name: "Admin" },
  ],
  steps: [
    {
      id: "start",
      type: "start",
      name: "Mulai",
      actorIds: ["staff"],
      next: "submit",
    },
    {
      id: "submit",
      type: "task",
      name: "Ajukan dokumen",
      actorIds: ["staff", "admin"],
      next: "review",
    },
    {
      id: "review",
      type: "decision",
      name: "Dokumen valid?",
      actorIds: ["manager"],
      yes: "end",
      no: "submit",
    },
    {
      id: "end",
      type: "end",
      name: "Selesai",
      actorIds: ["manager"],
    },
  ],
};

const smokeHeader: SopHeaderValue = {
  number: "SOP/DEMO/001",
  institutionName: "Sopflow Demo",
  createdDate: "2026-09-20",
  revisionDate: "2026-09-20",
  effectiveDate: "2026-09-20",
  lawBasis: [],
  qualifications: [],
  relatedSops: [],
  equipment: [],
  warnings: [],
  records: [],
  signatory: {
    name: "Pemilik SOP",
    role: "Manajer",
  },
};

const validDocument: SOPDocument = {
  ...smokeDocument,
  steps: smokeDocument.steps.map((step) => ({
    ...step,
    actorIds: step.id === "submit" ? ["staff"] : step.actorIds,
    input: "Dokumen permohonan",
    output: "Dokumen tercatat",
    note: "-",
  })),
};

const validHeader: SopHeaderValue = {
  ...smokeHeader,
  lawBasis: ["Peraturan instansi"],
  qualifications: ["Petugas administrasi"],
  relatedSops: ["-"],
  equipment: ["Komputer"],
  warnings: ["-"],
  records: ["Arsip permohonan"],
};

// Keep the intentionally incomplete fixture for the Problems navigation regression.
const isValidationRegression = new URLSearchParams(window.location.search).has(
  "unified-regression",
);

export function ReactPackageSmoke() {
  const [document, setDocument] = useState(
    isValidationRegression ? smokeDocument : validDocument,
  );
  const [header, setHeader] = useState(
    isValidationRegression ? smokeHeader : validHeader,
  );

  const diagramError = useMemo(() => {
    try {
      buildDiagram(document);
      return null;
    } catch (cause) {
      return cause instanceof Error
        ? cause.message
        : "Diagram tidak dapat dibangun karena kesalahan yang tidak diketahui.";
    }
  }, [document]);

  return (
    <section
      className="h-full min-h-0 w-full overflow-hidden print:h-auto print:overflow-visible"
      aria-label="Playground SOP"
    >
      <SopUnifiedWorkspace
        value={document}
        onChange={setDocument}
        header={header}
        onHeaderChange={setHeader}
        error={diagramError}
      />
    </section>
  );
}
