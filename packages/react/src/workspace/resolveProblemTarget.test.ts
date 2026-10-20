import { describe, expect, it } from "vitest";
import { problemKey, resolveProblemTarget } from "./resolveProblemTarget.js";

describe("resolveProblemTarget", () => {
  it("maps header, actor and step issues without parsing translated messages", () => {
    expect(
      resolveProblemTarget({
        kind: "header",
        code: "MISSING_HEADER_LIST",
        field: "lawBasis",
        message: "Dasar hukum harus diisi",
      }),
    ).toEqual({ kind: "header", field: "lawBasis" });
    expect(
      resolveProblemTarget({
        kind: "procedure",
        code: "MISSING_ACTOR",
        message: "Missing actor",
      }),
    ).toEqual({ kind: "actors" });
    expect(
      resolveProblemTarget({
        kind: "procedure",
        code: "MISSING_INPUT",
        stepId: "start",
        message: "Missing input",
      }),
    ).toEqual({ kind: "step", stepId: "start" });
  });

  it("prefers schema stepId and has a safe fallback for unknown schema paths", () => {
    const schema = {
      kind: "schema" as const,
      code: "invalid_type",
      path: ["steps", 0, "name"],
      stepId: "start",
      message: "Invalid step",
    };
    expect(resolveProblemTarget(schema)).toEqual({
      kind: "step",
      stepId: "start",
    });
    const unknown = {
      kind: "schema" as const,
      code: "custom",
      path: ["unknown", Symbol("field")],
      message: "Unknown path",
    };
    expect(resolveProblemTarget(unknown)).toEqual({ kind: "summary" });
    expect(problemKey(unknown)).toContain("Symbol(field)");
  });
});
