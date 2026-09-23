import { describe, expect, it } from "vitest";
import { exampleSop } from "./fixtures/exampleSop.js";
import { SOPDocumentSchema } from "../src/schema.js";

describe("SOPDocumentSchema", () => {
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
