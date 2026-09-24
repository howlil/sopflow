import { describe, expect, it } from "vitest";
import { exampleSop } from "./fixtures/exampleSop.js";
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

  it("reports invalid authored presentation order", () => {
    const issues = validateSop({
      ...exampleSop,
      presentationOrder: [
        "start",
        "prepare-document",
        "prepare-document",
        "missing",
      ],
    });

    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "DUPLICATE_PRESENTATION_STEP",
        stepId: "prepare-document",
      }),
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "UNKNOWN_PRESENTATION_STEP",
        stepId: "missing",
      }),
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "MISSING_PRESENTATION_STEP",
        stepId: "check-document",
      }),
    );
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

  it("detects duplicate actor ids", () => {
    const sop: SOPDocument = {
      ...exampleSop,
      actors: [...exampleSop.actors, { id: "staff", name: "Duplicate Staff" }],
    };

    expect(validateSop(sop)).toContainEqual(
      expect.objectContaining({
        code: "DUPLICATE_ACTOR_ID",
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

  it("allows multiple end steps when all branches reach an end", () => {
    const sop: SOPDocument = {
      schemaVersion: "1",
      id: "multiple-end",
      title: "Multiple End",
      actors: [],
      steps: [
        {
          id: "start",
          type: "start",
          name: "Mulai",
          actorIds: [],
          next: "decision",
        },
        {
          id: "decision",
          type: "decision",
          name: "Lulus?",
          actorIds: [],
          yes: "approved",
          no: "rejected",
        },
        {
          id: "approved",
          type: "end",
          name: "Disetujui",
          actorIds: [],
        },
        {
          id: "rejected",
          type: "end",
          name: "Ditolak",
          actorIds: [],
        },
      ],
    };

    expect(validateSop(sop)).toEqual([]);
  });

  it("accepts a cycle with an exit to an end step", () => {
    const sop: SOPDocument = {
      schemaVersion: "1",
      id: "cycle-with-exit",
      title: "Cycle With Exit",
      actors: [],
      steps: [
        {
          id: "start",
          type: "start",
          name: "Mulai",
          actorIds: [],
          next: "decision",
        },
        {
          id: "decision",
          type: "decision",
          name: "Perlu ulang?",
          actorIds: [],
          yes: "retry",
          no: "end",
        },
        {
          id: "retry",
          type: "task",
          name: "Ulangi",
          actorIds: [],
          next: "decision",
        },
        {
          id: "end",
          type: "end",
          name: "Selesai",
          actorIds: [],
        },
      ],
    };

    expect(validateSop(sop)).toEqual([]);
  });

  it("requires both named branches on a decision", () => {
    const sop: SOPDocument = {
      schemaVersion: "1",
      id: "missing-branch",
      title: "Missing Branch",
      actors: [],
      steps: [
        {
          id: "start",
          type: "start",
          name: "Mulai",
          actorIds: [],
          next: "decision",
        },
        {
          id: "decision",
          type: "decision",
          name: "Valid?",
          actorIds: [],
          yes: "end",
          no: "",
        },
        { id: "end", type: "end", name: "Selesai", actorIds: [] },
      ],
    };

    expect(validateSop(sop)).toContainEqual(
      expect.objectContaining({
        code: "INVALID_DECISION_BRANCH",
        stepId: "decision",
      }),
    );
  });

  it("detects steps taht cannot reach end", () => {
    const sop: SOPDocument = {
      schemaVersion: "1",
      id: "loop-only",
      title: "Loop Only",

      actors: [
        {
          id: "staff",
          name: "Staff",
        },
      ],

      steps: [
        {
          id: "start",
          type: "start",
          name: "Mulai",
          actorIds: ["staff"],
          next: "a",
        },

        {
          id: "a",
          type: "task",
          name: "A",
          actorIds: ["staff"],
          next: "b",
        },

        {
          id: "b",
          type: "task",
          name: "B",
          actorIds: ["staff"],
          next: "a",
        },

        {
          id: "end",
          type: "end",
          name: "Selesai",
          actorIds: ["staff"],
        },
      ],
    };

    const issues = validateSop(sop);

    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "CANNOT_REACH_END",
        stepId: "start",
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
