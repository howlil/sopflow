import { describe, expect, it } from "vitest";
import { exampleSop } from "./fixtures/exampleSop.js";
import { applyOperation, applyOperations } from "../src/operations.js";
import { validateSop } from "../src/validate.js";
import type { SOPDocument } from "../src/types.js";

describe("applyOperation", () => {
  it("applies actor operations", () => {
    const result = applyOperation(exampleSop, {
      type: "add-actor",
      actor: {
        id: "reviewer",
        name: "Reviewer",
      },
    });

    expect(result.actors).toContainEqual({
      id: "reviewer",
      name: "Reviewer",
    });
  });

  it("applies add-step operation", () => {
    const result = applyOperation(exampleSop, {
      type: "add-step",
      step: {
        id: "archive",
        type: "task",
        name: "Archive document",
        actorIds: ["staff"],
        next: "end",
      },
    });

    expect(result.steps.some((step) => step.id === "archive")).toBe(true);
  });

  it("inserts a step after the requested presentation-order step", () => {
    const result = applyOperation(exampleSop, {
      type: "insert-step",
      afterStepId: "prepare-document",
      step: {
        id: "collect-attachment",
        type: "task",
        name: "Collect attachment",
        actorIds: ["staff"],
        next: "check-document",
      },
    });

    expect(result.steps.map((step) => step.id)).toEqual([
      "start",
      "prepare-document",
      "collect-attachment",
      "check-document",
      "approve-document",
      "end",
    ]);
  });

  it("inserts a step before the requested presentation-order step", () => {
    const result = applyOperation(exampleSop, {
      type: "insert-step-before",
      beforeStepId: "end",
      step: {
        id: "archive",
        type: "task",
        name: "Archive document",
        actorIds: ["staff"],
        next: "end",
      },
    });

    expect(result.steps.map((step) => step.id)).toEqual([
      "start",
      "prepare-document",
      "check-document",
      "approve-document",
      "archive",
      "end",
    ]);
  });

  it("updates an existing step without removing it", () => {
    const result = applyOperation(exampleSop, {
      type: "update-step",
      step: {
        id: "prepare-document",
        type: "task",
        name: "Prepare required documents",
        actorIds: ["staff"],
        next: "check-document",
      },
    });

    expect(result.steps).toHaveLength(exampleSop.steps.length);
    expect(result.steps).toContainEqual(
      expect.objectContaining({
        id: "prepare-document",
        name: "Prepare required documents",
      }),
    );
  });
});

describe("applyOperations", () => {
  it("removes an actor after clearing its step references", () => {
    const operations = exampleSop.steps.map((step) => ({
      type: "update-step" as const,
      step: {
        ...step,
        actorIds: step.actorIds.filter((actorId) => actorId !== "staff"),
      },
    }));

    const result = applyOperations(exampleSop, [
      ...operations,
      {
        type: "remove-actor",
        actorId: "staff",
      },
    ]);

    expect(result.actors.some((actor) => actor.id === "staff")).toBe(false);
    expect(result.steps.every((step) => !step.actorIds.includes("staff"))).toBe(
      true,
    );
  });

  it("applies multiple operation in order", () => {
    const result = applyOperations(exampleSop, [
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
      {
        type: "connect",
        from: "approve-document",
        to: "archive",
      },
    ]);

    const approve = result.steps.find((step) => step.id === "approve-document");

    expect(approve?.type).toBe("task");

    if (approve?.type !== "task")
      throw new Error("approve-document is not task");

    expect(approve.next).toBe("archive");
  });

  it("inserts and reconnects a task in one ordered batch", () => {
    const result = applyOperations(exampleSop, [
      {
        type: "insert-step",
        afterStepId: "prepare-document",
        step: {
          id: "collect-attachment",
          type: "task",
          name: "Collect attachment",
          actorIds: ["staff"],
          next: "check-document",
        },
      },
      {
        type: "connect",
        from: "prepare-document",
        to: "collect-attachment",
      },
    ]);

    const prepare = result.steps.find((step) => step.id === "prepare-document");

    expect(result.steps.map((step) => step.id)).toEqual([
      "start",
      "prepare-document",
      "collect-attachment",
      "check-document",
      "approve-document",
      "end",
    ]);
    expect(prepare?.type).toBe("task");

    if (prepare?.type !== "task")
      throw new Error("prepare-document is not task");

    expect(prepare.next).toBe("collect-attachment");
  });

  it("rewires both decision branches when inserting before a shared end", () => {
    const document: SOPDocument = {
      schemaVersion: "1",
      id: "decision-sop",
      title: "Decision SOP",
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

    const result = applyOperations(document, [
      {
        type: "insert-step-before",
        beforeStepId: "end",
        step: {
          id: "review",
          type: "task",
          name: "Review",
          actorIds: [],
          next: "end",
        },
      },
      {
        type: "connect-decision",
        from: "decision",
        branch: "yes",
        to: "review",
      },
      {
        type: "connect-decision",
        from: "decision",
        branch: "no",
        to: "review",
      },
    ]);

    const decision = result.steps.find((step) => step.id === "decision");
    const review = result.steps.find((step) => step.id === "review");

    expect(result.steps.map((step) => step.id)).toEqual([
      "start",
      "decision",
      "review",
      "end",
    ]);
    expect(decision).toMatchObject({ yes: "review", no: "review" });
    expect(review).toMatchObject({ next: "end" });
    expect(validateSop(result)).toEqual([]);
  });

  it("removes actor references before deleting the actor", () => {
    const document: SOPDocument = {
      schemaVersion: "1",
      id: "actor-sop",
      title: "Actor SOP",
      actors: [
        { id: "manager", name: "Manager" },
        { id: "staff", name: "Staff" },
      ],
      steps: [
        {
          id: "start",
          type: "start",
          name: "Mulai",
          actorIds: [],
          next: "step-a",
        },
        {
          id: "step-a",
          type: "task",
          name: "A",
          actorIds: ["manager"],
          next: "step-b",
        },
        {
          id: "step-b",
          type: "task",
          name: "B",
          actorIds: ["manager", "staff"],
          next: "end",
        },
        {
          id: "end",
          type: "end",
          name: "Selesai",
          actorIds: [],
        },
      ],
    };

    const stepA = document.steps.find((step) => step.id === "step-a");
    const stepB = document.steps.find((step) => step.id === "step-b");

    if (stepA?.type !== "task" || stepB?.type !== "task") {
      throw new Error("Actor test steps are not tasks");
    }

    const result = applyOperations(document, [
      {
        type: "update-step",
        step: { ...stepA, actorIds: [] },
      },
      {
        type: "update-step",
        step: { ...stepB, actorIds: ["staff"] },
      },
      { type: "remove-actor", actorId: "manager" },
    ]);

    expect(result.actors).toEqual([{ id: "staff", name: "Staff" }]);
    expect(result.steps.find((step) => step.id === "step-a")?.actorIds).toEqual(
      [],
    );
    expect(result.steps.find((step) => step.id === "step-b")?.actorIds).toEqual(
      ["staff"],
    );
    expect(validateSop(result)).not.toContainEqual(
      expect.objectContaining({ code: "UNKNOWN_ACTOR_REFERENCE" }),
    );
  });

  it("rewires a linear predecessor before removing a task", () => {
    const result = applyOperations(exampleSop, [
      {
        type: "connect",
        from: "prepare-document",
        to: "approve-document",
      },
      {
        type: "remove-step",
        stepId: "check-document",
      },
    ]);

    const prepare = result.steps.find((step) => step.id === "prepare-document");

    expect(result.steps.some((step) => step.id === "check-document")).toBe(
      false,
    );
    expect(prepare?.type).toBe("task");

    if (prepare?.type !== "task")
      throw new Error("prepare-document is not task");

    expect(prepare.next).toBe("approve-document");
  });

  it("rewires a decision branch before removing its target", () => {
    const result = applyOperations(exampleSop, [
      {
        type: "connect-decision",
        from: "check-document",
        branch: "yes",
        to: "end",
      },
      {
        type: "remove-step",
        stepId: "approve-document",
      },
    ]);

    const decision = result.steps.find((step) => step.id === "check-document");

    expect(result.steps.some((step) => step.id === "approve-document")).toBe(
      false,
    );
    expect(decision?.type).toBe("decision");

    if (decision?.type !== "decision")
      throw new Error("check-document is not decision");

    expect(decision.yes).toBe("end");
  });
});
