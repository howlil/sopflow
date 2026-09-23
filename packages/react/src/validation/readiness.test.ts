import { describe, expect, it } from "vitest";
import type { SOPDocument, ValidationIssue } from "@sopflow/core";
import type { SopHeaderValue } from "../types.js";
import { getSopReadinessIssues, isSopReady } from "./readiness.js";

const document: SOPDocument = {
  schemaVersion: "1",
  id: "readiness",
  title: "Readiness",
  actors: [],
  steps: [
    {
      id: "start",
      type: "start",
      name: "Mulai",
      actorIds: [],
      next: "end",
    },
    { id: "end", type: "end", name: "Selesai", actorIds: [] },
  ],
};

const header: SopHeaderValue = {
  number: "SOP/001",
  institutionName: "Sopflow Demo",
  logoUrl: "logo.svg",
  createdDate: "2026-09-20",
  revisionDate: "2026-09-20",
  effectiveDate: "2026-09-20",
  signatory: { role: "Manajer", name: "Pemilik SOP", identifier: "NIP-001" },
  lawBasis: ["PermenPANRB 35/2012"],
  qualifications: ["Memahami prosedur"],
  relatedSops: ["—"],
  equipment: ["Komputer"],
  warnings: ["—"],
  records: ["Formulir"],
};

describe("SOP readiness", () => {
  it("combines graph and header validation at the React boundary", () => {
    expect(isSopReady(document, header)).toBe(true);

    const issues = getSopReadinessIssues(document, {
      ...header,
      number: "",
    });

    expect(issues).toContainEqual(
      expect.objectContaining({ kind: "header", field: "number" }),
    );
  });

  it("uses a supplied graph result instead of validating the document again", () => {
    const graphIssues: ValidationIssue[] = [
      {
        code: "MISSING_END",
        message: "supplied graph issue",
      },
    ];

    expect(getSopReadinessIssues(document, header, graphIssues)).toContainEqual(
      expect.objectContaining({
        kind: "graph",
        code: "MISSING_END",
        message: "supplied graph issue",
      }),
    );
  });
});
