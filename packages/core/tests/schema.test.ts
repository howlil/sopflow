import { describe, expect, it } from "vitest";
import { exampleSop } from "./fixtures/exampleSop.js";
import { SOPDocumentSchema } from "../src/schema.js";
import { getSopSchemaIssues } from "../src/schemaValidation.js";

describe("SOPDocumentSchema", () => {
  it("attaches step IDs to schema diagnostics for field-level editor feedback", () => {
    const invalid = {
      ...exampleSop,
      steps: exampleSop.steps.map((step) =>
        step.id === "prepare-document"
          ? { ...step, duration: { value: -1, unit: "minute" as const } }
          : step,
      ),
    };
    expect(getSopSchemaIssues(invalid)).toContainEqual(
      expect.objectContaining({
        stepId: "prepare-document",
        path: expect.arrayContaining(["steps"]),
      }),
    );
  });

  it("accents valid SOP document", () => {
    const result = SOPDocumentSchema.safeParse(exampleSop);

    expect(result.success).toBe(true);
  });

  it("rejects unknown schema version", () => {
    const input = {
      ...exampleSop,
      schemaVersion: "2",
    };

    const result = SOPDocumentSchema.safeParse(input);

    expect(result.success).toBe(false);
  });

  it("rejects step without id", () => {
    const input = {
      ...exampleSop,

      steps: [
        {
          type: "end",
          name: "Selesai",
          actorIds: ["staff"],
        },
      ],
    };

    const result = SOPDocumentSchema.safeParse(input);

    expect(result.success).toBe(false);
  });

  it("rejects invalid step type", () => {
    const input = {
      ...exampleSop,

      steps: [
        {
          id: "weird-step",
          type: "something",
          name: "unknown",
          actorIds: ["staff"],
        },
      ],
    };

    const result = SOPDocumentSchema.safeParse(input);

    expect(result.success).toBe(false);
  });

  it("rejects decision withour yes branch", () => {
    const input = {
      ...exampleSop,

      steps: [
        {
          id: "decision",
          type: "decision",
          name: "Valid?",
          actorIds: ["staff"],
          no: "end",
        },
      ],
    };

    const result = SOPDocumentSchema.safeParse(input);

    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only identifiers", () => {
    const result = SOPDocumentSchema.safeParse({
      ...exampleSop,
      id: "   ",
    });

    expect(result.success).toBe(false);
  });
});
