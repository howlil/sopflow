import { describe, expect, it } from "vitest";
import { exampleSop } from "./fixtures/exampleSop.js";
import { parseSop } from "../src/parse.js";

describe("parseSop", () => {
  it("accepts valid SOP", () => {
    const result = parseSop(exampleSop);

    expect(result.success).toBe(true);
  });

  it("rejects strcuturally invaid SOP", () => {
    const result = parseSop({
      ...exampleSop,
      schemaVersion: "2",
    });

    expect(result.success).toBe(false);
  });

  it("rejects sematically invalid SOP", () => {
    const result = parseSop({
      ...exampleSop,
      steps: exampleSop.steps.map((step) => {
        return step.id === "prepare-document"
          ? {
              ...step,
              next: "missing-step",
            }
          : step;
      }),
    });

    expect(result.success).toBe(false);
  });
});
