import { describe, expect, it } from "vitest";
import { exampleSop } from "../src/example.js";
import {
  addActor,
  addStep,
  removeActor,
  removeStep,
  updateActor,
  updateStep,
} from "../src/mutate.js";

describe("actor mutations", () => {
  it("adds, updates, and removes an actor", () => {
    const added = addActor(exampleSop, {
      id: "reviewer",
      name: "Reviewer",
    });
    const updated = updateActor(added, {
      id: "reviewer",
      name: "Lead Reviewer",
    });
    const removed = removeActor(updated, "reviewer");

    expect(updated.actors).toContainEqual({
      id: "reviewer",
      name: "Lead Reviewer",
    });
    expect(removed.actors).toEqual(exampleSop.actors);
  });

  it("rejects duplicate and missing actor mutations", () => {
    expect(() =>
      addActor(exampleSop, {
        id: "staff",
        name: "Staff",
      }),
    ).toThrow('Actor "staff" already exists');
    expect(() =>
      updateActor(exampleSop, {
        id: "missing",
        name: "Missing",
      }),
    ).toThrow('Actor "missing" does not exist');
  });

  it("rejects removing an actor still referenced by a step", () => {
    expect(() => removeActor(exampleSop, "staff")).toThrow(
      'Actor "staff" is still used by',
    );
  });
});

describe("addStep", () => {
  it("add a new step", () => {
    const result = addStep(exampleSop, {
      id: "archive",
      type: "task",
      name: "Archive document",
      actorIds: ["staff"],
      next: "end",
    });

    expect(result.steps.some((step) => step.id === "archive")).toBe(true);

    expect(result.steps).toHaveLength(exampleSop.steps.length + 1);
  });

  it("does nit mutate original document", () => {
    addStep(exampleSop, {
      id: "archive",
      type: "task",
      name: "Archive document",
      actorIds: ["staff"],
      next: "end",
    });

    expect(exampleSop.steps.some((step) => step.id === "archive")).toBe(false);
  });
});

describe("removeStep", () => {
  it("rejects removing a referenced step", () => {
    expect(() => removeStep(exampleSop, "approve-document")).toThrow(
      'Step "approve-document" is still referenced by "check-document"',
    );
  });

  it("rejects removing a missing step", () => {
    expect(() => removeStep(exampleSop, "missing")).toThrow(
      'Step "missing" does not exist',
    );
  });
});

describe("updateStep", () => {
  it("update exist step", () => {
    const original = exampleSop.steps.find(
      (step) => step.id === "prepare-document",
    );

    if (!original) throw new Error("Step not found");

    const result = updateStep(exampleSop, {
      ...original,
      name: "Prepare required documents",
    });

    const updated = result.steps.find((step) => step.id === "prepare-document");

    expect(updated?.name).toBe("Prepare required documents");
  });
});
