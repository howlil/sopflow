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
    ).toEqual({ kind: "step", stepId: "start", field: "input" });
  });

  it("maps specific SOP-AP fields without reading message text", () => {
    for (const [code, field] of [
      ["INVALID_ACTOR_COUNT", "actorIds"],
      ["MISSING_ACTIVITY", "name"],
      ["MISSING_INPUT", "input"],
      ["MISSING_OUTPUT", "output"],
      ["MISSING_NOTE", "note"],
      ["IDENTICAL_DECISION_TARGETS", "decisionRoutes"],
    ] as const) {
      expect(
        resolveProblemTarget({
          kind: "procedure",
          code,
          stepId: "start",
          message: "localized text can change",
        }),
      ).toEqual({ kind: "step", stepId: "start", field });
    }
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
      field: "name",
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
