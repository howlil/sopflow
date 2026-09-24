import { describe, expect, it } from "vitest";
import type { SOPDocument } from "@sopflow/core";
import {
  getSopApReadinessIssues,
  isSopApReady,
  type SopApHeader,
} from "../src/index.js";

const quality = {
  input: "Berkas",
  output: "Hasil",
  note: "-",
};

const document: SOPDocument = {
  schemaVersion: "1",
  id: "sop-ap",
  title: "Pengajuan Dokumen",
  actors: [{ id: "staff", name: "Staff" }],
  presentationOrder: ["start", "end"],
  steps: [
    {
      id: "start",
      type: "start",
      name: "Mulai",
      actorIds: ["staff"],
      next: "end",
      ...quality,
    },
    {
      id: "end",
      type: "end",
      name: "Selesai",
      actorIds: ["staff"],
      ...quality,
    },
  ],
};

const header: SopApHeader = {
  number: "SOP/001",
  institutionName: "Instansi",
  lawBasis: ["Peraturan"],
  qualifications: ["Kompeten"],
  relatedSops: ["-"],
  equipment: ["Komputer"],
  warnings: ["-"],
  records: ["Formulir"],
};

describe("SOP AP readiness", () => {
  it("accepts a structurally valid and profile-complete document", () => {
    expect(isSopApReady(document, header)).toBe(true);
  });

  it("requires exactly one actor and procedure quality fields", () => {
    const issues = getSopApReadinessIssues(
      {
        ...document,
        steps: document.steps.map((step) =>
          step.id === "start"
            ? {
                ...step,
                name: "",
                actorIds: ["staff", "other"],
                input: "",
              }
            : step,
        ),
      },
      header,
    );

    expect(issues).toContainEqual(
      expect.objectContaining({
        kind: "procedure",
        code: "INVALID_ACTOR_COUNT",
        stepId: "start",
      }),
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        kind: "procedure",
        code: "MISSING_ACTIVITY",
        stepId: "start",
      }),
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        kind: "procedure",
        code: "MISSING_INPUT",
        stepId: "start",
      }),
    );
  });

  it("keeps optional dates optional but validates them when supplied", () => {
    expect(
      getSopApReadinessIssues(document, {
        ...header,
        revisionDate: "2026-02-31",
      }),
    ).toContainEqual(
      expect.objectContaining({
        kind: "header",
        code: "INVALID_HEADER_DATE",
        field: "revisionDate",
      }),
    );
  });
});
