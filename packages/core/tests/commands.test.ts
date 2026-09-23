import { describe, expect, it } from "vitest";
import { exampleSop } from "./fixtures/exampleSop.js";
import {
  buildChangeStepTypeOperations,
  buildCreateInitialWorkflowOperations,
  buildInsertTaskAfterOperations,
  buildInsertTaskBeforeEndOperations,
  buildRemoveActorAndReferencesOperations,
  buildRemoveStepAndReconnectOperations,
  buildSetDecisionBranchesOperations,
  getStepRemovalOptions,
} from "../src/commands.js";
import { applyOperations } from "../src/operations.js";
import type { SOPDocument } from "../src/types.js";
import { validateSop } from "../src/validate.js";

describe("graph commands", () => {
  it("creates a valid initial workflow without React-owned topology", () => {
    const empty: SOPDocument = {
      schemaVersion: "1",
      id: "empty",
      title: "Empty",
      actors: [{ id: "staff", name: "Staff" }],
      steps: [],
    };

    const result = applyOperations(
      empty,
      buildCreateInitialWorkflowOperations(empty, {
        startId: "start",
        taskId: "task",
        endId: "end",
      }),
    );

    expect(result.steps.map((step) => step.id)).toEqual([
      "start",
      "task",
      "end",
    ]);
    expect(validateSop(result)).toEqual([]);
  });

  it("inserts a task after a linear source and rewires its next edge", () => {
    const result = applyOperations(
      exampleSop,
      buildInsertTaskAfterOperations(
        exampleSop,
        "prepare-document",
        "collect-attachment",
      ),
    );

    expect(result.steps.map((step) => step.id)).toContain("collect-attachment");
    expect(
      result.steps.find((step) => step.id === "prepare-document"),
    ).toMatchObject({
      next: "collect-attachment",
    });
    expect(
      result.steps.find((step) => step.id === "collect-attachment"),
    ).toMatchObject({
      next: "check-document",
    });
  });

  it("inserts before the single end and rewires every incoming branch", () => {
    const document: SOPDocument = {
      schemaVersion: "1",
      id: "decision",
      title: "Decision",
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
          yes: "end",
          no: "end",
        },
        {
          id: "end",
          type: "end",
          name: "Selesai",
          actorIds: [],
        },
      ],
    };

    const result = applyOperations(
      document,
      buildInsertTaskBeforeEndOperations(document, "review"),
    );

    expect(result.steps.map((step) => step.id)).toEqual([
      "start",
      "decision",
      "review",
      "end",
    ]);
    expect(result.steps.find((step) => step.id === "decision")).toMatchObject({
      yes: "review",
      no: "review",
    });
    expect(validateSop(result)).toEqual([]);
  });

  it("converts task to decision while preserving the current next target", () => {
    const operations = buildChangeStepTypeOperations(
      exampleSop,
      "prepare-document",
      "decision",
    );

    const result = applyOperations(exampleSop, operations);
    expect(
      result.steps.find((step) => step.id === "prepare-document"),
    ).toMatchObject({
      type: "decision",
      yes: "check-document",
      no: "check-document",
    });
  });

  it("sets both decision branches through one core command", () => {
    const result = applyOperations(
      exampleSop,
      buildSetDecisionBranchesOperations(
        exampleSop,
        "check-document",
        "approve-document",
        "prepare-document",
      ),
    );

    expect(
      result.steps.find((step) => step.id === "check-document"),
    ).toMatchObject({
      yes: "approve-document",
      no: "prepare-document",
    });
  });

  it("provides only removal targets that keep the workflow valid", () => {
    const options = getStepRemovalOptions(exampleSop, "approve-document");

    expect(options.requiresReplacement).toBe(true);
    expect(options.candidates.map((step) => step.id)).toContain("end");
    expect(options.candidates.map((step) => step.id)).not.toContain(
      "approve-document",
    );
  });

  it("rewires incoming edges before removing a referenced step", () => {
    const result = applyOperations(
      exampleSop,
      buildRemoveStepAndReconnectOperations(
        exampleSop,
        "approve-document",
        "end",
      ),
    );

    expect(result.steps.some((step) => step.id === "approve-document")).toBe(
      false,
    );
    expect(
      result.steps.find((step) => step.id === "check-document"),
    ).toMatchObject({
      yes: "end",
    });
    expect(validateSop(result)).toEqual([]);
  });

  it("clears actor references before removing an actor", () => {
    const result = applyOperations(
      exampleSop,
      buildRemoveActorAndReferencesOperations(exampleSop, "staff"),
    );

    expect(result.actors.some((actor) => actor.id === "staff")).toBe(false);
    expect(result.steps.every((step) => !step.actorIds.includes("staff"))).toBe(
      true,
    );
  });
});
