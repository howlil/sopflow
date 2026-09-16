import { describe, expect, it } from "vitest";
import { exampleSop } from "../src/example.js";
import type { SOPDocument } from "../src/types.js";
import {
  validateReachability,
  validateReference,
  validateSop,
} from "../src/validate.js";

describe("validateSop", () => {
  it("accept a valid SOP", () => {
    const issues = validateSop(exampleSop);

    expect(issues).toEqual([]);
  });

  it("detects duplicates step ids", () => {
    const sop: SOPDocument = {
      ...exampleSop,
      steps: [
        ...exampleSop.steps,
        {
          id: "end",
          type: "end",
          name: "Duplicate end",
          actorIds: ["staff"],
        },
      ],
    };

    const issues = validateSop(sop);

    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "DUPLICATE_STEP_ID",
        stepId: "end",
      }),
    );
  });

  it("detects unknown actore references", () => {
    const sop: SOPDocument = {
      ...exampleSop,

      steps: exampleSop.steps.map((step) => {
        return step.id === "prepare-document"
          ? {
              ...step,
              actorIds: ["unknown-actor"],
            }
          : step;
      }),
    };

    const issues = validateSop(sop);

    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "UNKNOWN_ACTOR_REFERENCE",
        stepId: "prepare-document",
      }),
    );
  });

  it("reject SOP without start", () => {
    const sop: SOPDocument = {
      ...exampleSop,

      steps: exampleSop.steps.filter((step) => step.type !== "start"),
    };

    const issues = validateSop(sop);

    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "INVALID_START_COUNT",
      }),
    );
  });

  it("reject SOP with multiple strat", () => {
    const sop: SOPDocument = {
      ...exampleSop,

      steps: [
        ...exampleSop.steps,

        {
          id: "another-start",
          type: "start",
          name: "Another start",
          actorIds: ["staff"],
          next: "prepare-document",
        },
      ],
    };

    const issues = validateSop(sop);

    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "INVALID_START_COUNT",
      }),
    );
  });

  it("rejects SOP without end", () => {
    const sop: SOPDocument = {
      ...exampleSop,

      steps: exampleSop.steps.filter((step) => step.type !== "end"),
    };

    const issues = validateSop(sop);

    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "MISSING_END",
      }),
    );
  });
});

describe("validateReference", () => {
  it("return no issue when every reference exist", () => {
    expect(validateReference(exampleSop)).toEqual([]);
  });

  it("detects unknown next step", () => {
    const sop: SOPDocument = {
      ...exampleSop,

      steps: exampleSop.steps.map((step) => {
        if (step.id !== "prepare-document") {
          return step;
        }

        return {
          ...step,
          next: "missing-step",
        };
      }),
    };

    const issues = validateReference(sop);

    expect(issues).toContainEqual({
      code: "UNKNOWN_STEP_REFERENCE",
      stepId: "prepare-document",
      message: 'Step "prepare-document" points to unknown step "missing-step"',
    });
  });

  it("detects unknown decision branch", () => {
    const sop: SOPDocument = {
      ...exampleSop,

      steps: exampleSop.steps.map((step) => {
        if (step.id !== "check-document") {
          return step;
        }

        if (step.type !== "decision") {
          return step;
        }

        return {
          ...step,
          no: "unknown-step",
        };
      }),
    };

    const issues = validateReference(sop);

    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "UNKNOWN_STEP_REFERENCE",
        stepId: "check-document",
      }),
    );
  });
});

describe("validateReachability", () => {
  it("return no issue when all steps are reachable", () => {
    expect(validateReachability(exampleSop)).toEqual([]);
  });

  it("detects unreachable steps", () => {
    const sop: SOPDocument = {
      ...exampleSop,

      steps: [
        ...exampleSop.steps,

        {
          id: "orphan-step",
          type: "task",
          name: "Orphan task",
          actorIds: ["staff"],
          next: "end",
        },
      ],
    };

    const issues = validateReachability(sop);

    expect(issues).toContainEqual({
      code: "UNREACHABLE_STEP",
      stepId: "orphan-step",
      message: 'Step "orphan-step" cannot be reached from start',
    });
  });
});
