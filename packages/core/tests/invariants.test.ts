import { describe, expect, it } from "vitest";
import { exampleSop } from "../src/example.js";
import { SopCoreError } from "../src/errors.js";
import {
  connectDecisionBranch,
  connectStep,
  removeStep,
  updateStep,
} from "../src/mutate.js";
import {
  applyOperationInput,
  applyValidatedOperations,
} from "../src/operations.js";
import { validateSop } from "../src/validate.js";

describe("core invariants", () => {
  it("rejects unknown connection targets", () => {
    expect(() => connectStep(exampleSop, "start", "missing")).toThrow(
      'Target step "missing" does not exist',
    );

    expect(() =>
      connectDecisionBranch(exampleSop, "check-document", "yes", "missing"),
    ).toThrow('Target step "missing" does not exist');
  });

  it("rejects unknown connection sources", () => {
    expect(() => connectStep(exampleSop, "missing", "end")).toThrow(
      'Source step "missing" does not exist',
    );

    expect(() =>
      connectDecisionBranch(exampleSop, "missing", "yes", "end"),
    ).toThrow('Source step "missing" does not exist');
  });

  it("rejects removing protected or referenced steps", () => {
    expect(() => removeStep(exampleSop, "start")).toThrow(
      "The start step cannot be removed",
    );
    expect(() => removeStep(exampleSop, "end")).toThrow(
      "The end step cannot be removed",
    );
    expect(() => removeStep(exampleSop, "approve-document")).toThrow(
      'Step "approve-document" is still referenced by "check-document"',
    );
  });

  it("rejects updates with unknown actors or targets", () => {
    const task = exampleSop.steps.find(
      (step) => step.id === "prepare-document",
    );

    if (task?.type !== "task") throw new Error("Task not found");

    expect(() =>
      updateStep(exampleSop, {
        ...task,
        actorIds: ["missing-actor"],
      }),
    ).toThrow(
      'Step "prepare-document" references unknown actor "missing-actor"',
    );

    expect(() =>
      updateStep(exampleSop, {
        ...task,
        next: "missing-step",
      }),
    ).toThrow('Target step "missing-step" does not exist');
  });

  it("validates the final state of a batch", () => {
    const result = applyValidatedOperations(exampleSop, [
      {
        type: "add-step",
        step: {
          id: "archive",
          type: "task",
          name: "Archive document",
          actorIds: ["staff"],
          next: "end",
        },
      },
      { type: "connect", from: "approve-document", to: "archive" },
    ]);

    expect(validateSop(result)).toEqual([]);
  });

  it("does not accept invalid operation input", () => {
    try {
      applyOperationInput(exampleSop, {
        type: "connect-decision",
        from: "check-document",
        branch: "maybe",
        to: "end",
      });
      throw new Error("Expected operation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(SopCoreError);
      expect((error as SopCoreError).code).toBe("INVALID_OPERATION");
    }
  });
});
