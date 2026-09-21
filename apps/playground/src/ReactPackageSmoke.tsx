import { useMemo, useState } from "react";
import type { SOPDocument } from "@sopflow/core";
import { buildDiagram } from "@sopflow/diagram";
import { SopWorkspace, type SopHeaderValue } from "@sopflow/react";
import "@sopflow/react/styles.css";

const smokeDocument: SOPDocument = {
  schemaVersion: "1",
  id: "demo",
  title: "Pengajuan Dokumen",
  actors: [
    { id: "staff", name: "Staff" },
    { id: "manager", name: "Manager" },
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
      actorIds: ["staff"],
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

export function ReactPackageSmoke() {
  const [document, setDocument] = useState(smokeDocument);
  const [header, setHeader] = useState(smokeHeader);
  const diagram = useMemo(() => buildDiagram(document), [document]);

  return (
    <section
      className="mx-auto w-full max-w-[1480px] border-y border-rule bg-surface"
      aria-labelledby="react-package-smoke-title"
    >
      <div className="flex min-h-16 flex-col items-start justify-end gap-2 border-b border-rule px-3.5 py-4 sm:flex-row sm:items-end sm:justify-between sm:gap-[18px] sm:px-5">
        <div className="min-w-0">
          <span className="mb-1.5 block font-mono text-[0.625rem] uppercase tracking-[0.08em] text-vermilion">
            Package surface
          </span>
          <h2
            id="react-package-smoke-title"
            className="text-balance text-[clamp(1.125rem,2vw,1.5rem)] font-semibold leading-tight tracking-[-0.025em] text-ink"
          >
            Core + diagram + React smoke
          </h2>
        </div>
        <span className="font-mono text-[0.625rem] uppercase leading-snug tracking-[0.08em] text-muted sm:text-right">
          @SOPFLOW/CORE · DIAGRAM · REACT
        </span>
      </div>
      <div className="min-w-0 overflow-x-auto p-3.5 sm:p-5">
        <output
          className="mb-3 block font-mono text-[0.6875rem] text-muted"
          aria-label="Ringkasan model diagram"
        >
          {diagram.nodes.length} node · {diagram.edges.length} edge
          {diagram.diagnostics.length > 0
            ? ` · ${diagram.diagnostics.length} diagnostic`
            : " · graph valid"}
        </output>
        <SopWorkspace
          value={document}
          onChange={setDocument}
          header={header}
          onHeaderChange={setHeader}
        />
      </div>
    </section>
  );
}
