import { describe, expect, it } from "vitest";
import { exampleSop } from "../src/example.js";
import { parseSop } from "../src/parse.js";

describe("parseSop", () => {
  it("should parse a valid SOP document successfully", () => {
    const result = parseSop(exampleSop);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(exampleSop);
    }
  });

  it("should fail for invalid input", () => {
    const result = parseSop({ invalid: "data" });
    expect(result.success).toBe(false);
  });
});
