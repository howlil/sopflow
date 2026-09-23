import { useEffect, useMemo, useState } from "react";
import type { SOPDocument } from "@sopflow/core";
import { buildDiagram } from "@sopflow/diagram";
import {
  SopWorkspace,
  type SopHeaderValue,
  type SopReadinessIssue,
} from "@sopflow/react";
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

export function ReactPackageSmoke() {
  const [document, setDocument] = useState(smokeDocument);
  const [header, setHeader] = useState(smokeHeader);
  const [readinessIssues, setReadinessIssues] = useState<
    readonly SopReadinessIssue[]
  >([]);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const diagramState = useMemo(() => {
    try {
      return {
        diagram: buildDiagram(document),
        error: null,
      };
    } catch (cause) {
      return {
        diagram: null,
        error:
          cause instanceof Error
            ? cause.message
            : "Diagram tidak dapat dibangun karena terjadi kesalahan yang tidak diketahui.",
      };
    }
  }, [document]);

  useEffect(() => {
    if (!issuesOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIssuesOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [issuesOpen]);

  return (
    <section
      className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-surface"
      aria-labelledby="playground-sop-title"
    >
      <div className="relative z-10 flex h-11 shrink-0 items-center justify-between border-b border-rule px-3">
        <h1
          id="playground-sop-title"
          className="text-[clamp(1.125rem,2vw,1.5rem)] font-semibold leading-tight tracking-[-0.025em] text-ink"
        >
          Playground SOP
        </h1>

        {readinessIssues.length > 0 ? (
          <div className="relative">
            <button
              type="button"
              className="inline-flex h-7 items-center gap-1.5 rounded-control px-2 text-xs font-semibold text-vermilion hover:bg-[#fff1ef] focus-visible:outline-2 focus-visible:outline-vermilion focus-visible:outline-offset-2"
              aria-expanded={issuesOpen}
              aria-controls="playground-sop-issues"
              aria-label={`${readinessIssues.length} masalah validasi SOP`}
              onClick={() => setIssuesOpen((current) => !current)}
            >
              <span
                className="grid h-4 w-4 place-items-center rounded-full border border-current text-[0.625rem] leading-none"
                aria-hidden="true"
              >
                !
              </span>
              <span aria-hidden="true">{readinessIssues.length}</span>
            </button>

            {issuesOpen ? (
              <div
                id="playground-sop-issues"
                className="absolute right-0 top-[calc(100%+0.5rem)] w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-[#f0b2aa] bg-surface shadow-[0_12px_30px_rgba(20,36,43,0.16)]"
                role="dialog"
                aria-label="Masalah validasi SOP"
              >
                <div className="flex items-center justify-between border-b border-[#f0d0cc] px-3 py-2">
                  <strong className="text-xs text-vermilion">
                    {readinessIssues.length} masalah validasi
                  </strong>
                  <button
                    type="button"
                    className="rounded-control px-1.5 text-sm text-muted hover:bg-[#fff1ef] hover:text-vermilion focus-visible:outline-2 focus-visible:outline-vermilion focus-visible:outline-offset-2"
                    aria-label="Tutup masalah validasi"
                    onClick={() => setIssuesOpen(false)}
                  >
                    ×
                  </button>
                </div>
                <ul className="playground-scrollbar-hidden grid max-h-[min(22rem,60vh)] gap-1 overflow-y-auto px-3 py-2 text-xs leading-5 text-ink">
                  {readinessIssues.map((issue) => (
                    <li key={readinessIssueKey(issue)}>{issue.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <SopWorkspace
            value={document}
            onChange={setDocument}
            header={header}
            onHeaderChange={setHeader}
            error={diagramState.error}
            onReadinessChange={setReadinessIssues}
            showValidationPanel={false}
          />
        </div>
      </div>
    </section>
  );
}

function readinessIssueKey(issue: SopReadinessIssue): string {
  const detail = "field" in issue ? issue.field : (issue.stepId ?? "");
  return `${issue.kind}:${issue.code}:${detail}:${issue.message}`;
}
