import { describe, expect, it } from "vitest";
import type { SOPDocument } from "../src/index.js";
import {
  getSopApReadinessIssues,
  isSopApReady,
  type SopApHeader,
} from "../src/sop-ap.js";

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
  it("does not mark invalid schema documents as ready even when graph and profile pass", () => {
    const unnamedActor: SOPDocument = {
      ...document,
      actors: [{ id: "staff", name: "" }],
    };
    expect(isSopApReady(unnamedActor, header)).toBe(false);
    expect(getSopApReadinessIssues(unnamedActor, header)).toContainEqual(
      expect.objectContaining({ kind: "schema", path: ["actors", 0, "name"] }),
    );
  });

  it("reports missing actorIds as schema diagnostics without traversing malformed steps", () => {
    const malformed = {
      ...document,
      steps: document.steps.map((step) =>
        step.id === "start"
          ? { id: step.id, type: step.type, name: step.name, next: "end" }
          : step,
      ),
    } as unknown as SOPDocument;

    expect(() => getSopApReadinessIssues(malformed, header)).not.toThrow();
    expect(getSopApReadinessIssues(malformed, header)).toContainEqual(
      expect.objectContaining({
        kind: "schema",
        path: ["steps", 0, "actorIds"],
      }),
    );
    expect(isSopApReady(malformed, header)).toBe(false);
  });

  it("reports malformed step collections and unknown step types as schema diagnostics", () => {
    const missingSteps = { ...document, steps: null } as unknown as SOPDocument;
    const unknownType = {
      ...document,
      steps: [{ ...document.steps[0], type: "unknown" }, document.steps[1]],
    } as unknown as SOPDocument;

    for (const malformed of [missingSteps, unknownType]) {
      expect(() => getSopApReadinessIssues(malformed, header)).not.toThrow();
      expect(getSopApReadinessIssues(malformed, header)).toEqual(
        expect.arrayContaining([expect.objectContaining({ kind: "schema" })]),
      );
    }
  });

  it("reports malformed header fields without crashing", () => {
    const malformed = {
      ...header,
      institutionName: undefined,
      lawBasis: null,
      qualifications: ["", null],
      createdDate: 1234,
    } as unknown as SopApHeader;

    expect(() => getSopApReadinessIssues(document, malformed)).not.toThrow();
    expect(getSopApReadinessIssues(document, malformed)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "header",
          code: "MISSING_HEADER_VALUE",
          field: "institutionName",
        }),
        expect.objectContaining({
          kind: "header",
          code: "MISSING_HEADER_LIST",
          field: "lawBasis",
        }),
        expect.objectContaining({
          kind: "header",
          code: "INVALID_HEADER_DATE",
          field: "createdDate",
        }),
      ]),
    );
  });

  it("keeps a decision draft editable but blocks publication until branches differ", () => {
    const start = document.steps[0];
    const end = document.steps[1];
    if (!start || !end) throw new Error("Test document requires start and end");
    const decisionDraft: SOPDocument = {
      ...document,
      presentationOrder: ["start", "decision", "end"],
      steps: [
        {
          ...start,
          next: "decision",
        } as SOPDocument["steps"][number],
        {
          id: "decision",
          type: "decision",
          name: "Periksa",
          actorIds: ["staff"],
          yes: "end",
          no: "end",
          ...quality,
        },
        end,
      ],
    };
    expect(getSopApReadinessIssues(decisionDraft, header)).toContainEqual(
      expect.objectContaining({
        kind: "procedure",
        code: "IDENTICAL_DECISION_TARGETS",
        stepId: "decision",
      }),
    );
    expect(isSopApReady(decisionDraft, header)).toBe(false);
  });

  it("rejects invalid durations in strict readiness", () => {
    const invalid: SOPDocument = {
      ...document,
      steps: document.steps.map((step) =>
        step.id === "start"
          ? { ...step, duration: { value: -5, unit: "minute" } }
          : step,
      ),
    };
    expect(isSopApReady(invalid, header)).toBe(false);
    expect(getSopApReadinessIssues(invalid, header)).toContainEqual(
      expect.objectContaining({
        kind: "schema",
        path: ["steps", 0, "duration", "value"],
      }),
    );
  });
});
