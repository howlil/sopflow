import { describe, expect, it } from "vitest";
import { exampleSop } from "../src/example.js";
import { getNextStepIds, getReachableStepIds, getStep } from "../src/graph.js";

describe("getStep", () => {
  it("return a step by id", () => {
    const step = getStep(exampleSop, "prepare-document");

    expect(step).toBeDefined();
    expect(step?.type).toBe("task");
    expect(step?.name).toBe("Prepare Document");
  });

  it("returns undifined when step does not exist", () => {
    const step = getStep(exampleSop, "unknown-step");

    expect(step).toBeUndefined();
  });
});

describe("getNextStepIds", () => {
  it("return next step for start", () => {
    const step = getStep(exampleSop, "start");

    if (!step) throw new Error("Step not found");

    expect(getNextStepIds(step)).toEqual(["prepare-document"]);
  });

  it("return yes and no branches for decision", () => {
    const step = getStep(exampleSop, "check-document");

    if (!step) throw new Error("step not found");

    expect(getNextStepIds(step)).toEqual([
      "approve-document",
      "prepare-document",
    ]);
  });

  it("return empty array for end", () => {
    const step = getStep(exampleSop, "end");

    if (!step) throw new Error("Step not found");

    expect(getNextStepIds(step)).toEqual([]);
  });
});

describe("getReachableStepIds", () => {
  it("find every reachable step from start", () => {
    const reachable = getReachableStepIds(exampleSop);

    expect(reachable).toEqual(
      new Set([
        "start",
        "prepare-document",
        "check-document",
        "approve-document",
        "end",
      ]),
    );
  });

  it("does not get stuck when the SOP contains a Loop", () => {
    const reachable = getReachableStepIds(exampleSop);

    expect(reachable.size).toBe(5);
  });
});
