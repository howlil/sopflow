import { describe, expect, it } from "vitest";
import { exampleSop } from "./fixtures/exampleSop.js";
import {
  getOrderedStepIds,
  getNextStepIds,
  getReachableStepIds,
  getStep,
  getPreviousStepIds,
  getPreviousConnections,
  getIncomingConnections,
  createGraphIndex,
  canReachEnd,
  findCycleStepIds,
} from "../src/graph.js";
import type { SOPDocument } from "../src/types.js";

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

describe("getOrderedStepIds", () => {
  it("orders reachable steps from the graph and keeps end terminal", () => {
    const end = getStep(exampleSop, "end");
    const approve = getStep(exampleSop, "approve-document");

    if (!end || !approve) throw new Error("Example terminal steps not found");

    const document = {
      ...exampleSop,
      steps: [
        ...exampleSop.steps.filter(
          (step) => step.id !== "end" && step.id !== "approve-document",
        ),
        end,
        approve,
      ],
    };

    expect(getOrderedStepIds(document)).toEqual([
      "start",
      "prepare-document",
      "check-document",
      "approve-document",
      "end",
    ]);
  });

  it("keeps orphan records visible after the graph", () => {
    const document = {
      ...exampleSop,
      steps: [
        ...exampleSop.steps,
        {
          id: "orphan",
          type: "task" as const,
          name: "Orphan",
          actorIds: ["staff"],
          next: "end",
        },
      ],
    };

    expect(getOrderedStepIds(document).at(-1)).toBe("orphan");
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

describe("getPreviousStepIds", () => {
  it("return incoming steps", () => {
    const previous = getPreviousStepIds(exampleSop, "check-document");

    expect(previous).toEqual(["prepare-document"]);
  });

  it("return multiple incoming steps", () => {
    const previous = getPreviousStepIds(exampleSop, "prepare-document");

    expect(previous).toEqual(
      expect.arrayContaining(["start", "check-document"]),
    );
  });
});

describe("getPreviousConnections", () => {
  it("preserves Ya and Tidak when both branches converge", () => {
    const document: SOPDocument = {
      schemaVersion: "1",
      id: "converging-previous",
      title: "Converging Previous",
      actors: [],
      steps: [
        {
          id: "decision",
          type: "decision",
          name: "Lanjut?",
          actorIds: [],
          yes: "target",
          no: "target",
        },
        {
          id: "target",
          type: "task",
          name: "Target",
          actorIds: [],
          next: "end",
        },
        { id: "end", type: "end", name: "Selesai", actorIds: [] },
      ],
    };

    expect(getPreviousConnections(document, "target")).toEqual([
      { from: "decision", type: "yes" },
      { from: "decision", type: "no" },
    ]);
  });
});

describe("getIncomingConnections", () => {
  it("returns incoming next and branch edges", () => {
    const connections = getIncomingConnections(exampleSop, "prepare-document");

    expect(connections).toEqual([
      { from: "start", type: "next" },
      { from: "check-document", type: "no" },
    ]);
  });

  it("returns an empty list for an unreferenced step", () => {
    const document: SOPDocument = {
      ...exampleSop,
      steps: [
        ...exampleSop.steps,
        {
          id: "orphan",
          type: "task",
          name: "Orphan",
          actorIds: ["staff"],
          next: "end",
        },
      ],
    };

    expect(getIncomingConnections(document, "orphan")).toEqual([]);
  });
});

describe("createGraphIndex", () => {
  it("records converging decision branches once each", () => {
    const document: SOPDocument = {
      schemaVersion: "1",
      id: "converging",
      title: "Converging",
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
          name: "Lanjut?",
          actorIds: [],
          yes: "end",
          no: "end",
        },
        { id: "end", type: "end", name: "Selesai", actorIds: [] },
      ],
    };

    expect(createGraphIndex(document).incomingByStepId.get("end")).toEqual([
      { from: "decision", type: "yes" },
      { from: "decision", type: "no" },
    ]);
  });
});

describe("canReachEnd", () => {
  it("return tru when a step can eventually reach end", () => {
    expect(canReachEnd(exampleSop, "prepare-document")).toBe(true);
  });

  it("return false when trapped in a loop without end", () => {
    const sop: SOPDocument = {
      ...exampleSop,

      steps: [
        {
          id: "start",
          type: "start",
          name: "Mulai",
          actorIds: ["staff"],
          next: "loop-a",
        },

        {
          id: "loop-a",
          type: "task",
          name: "Loop A",
          actorIds: ["staff"],
          next: "loop-b",
        },

        {
          id: "loop-b",
          type: "task",
          name: "Loop B",
          actorIds: ["staff"],
          next: "loop-a",
        },

        {
          id: "end",
          type: "end",
          name: "Selesai",
          actorIds: ["staff"],
        },
      ],
    };

    expect(canReachEnd(sop, "start")).toBe(false);
  });
});

describe("findCycleStepIds", () => {
  it("detects loop in SOP", () => {
    const cycles = findCycleStepIds(exampleSop);

    expect(cycles.has("prepare-document")).toBe(true);
  });

  it("does not mark a non-cycle predecessor as part of the loop", () => {
    const document: SOPDocument = {
      ...exampleSop,
      steps: [
        {
          id: "start",
          type: "start",
          name: "Mulai",
          actorIds: [],
          next: "loop",
        },
        {
          id: "loop",
          type: "task",
          name: "Loop",
          actorIds: [],
          next: "loop",
        },
        {
          id: "end",
          type: "end",
          name: "Selesai",
          actorIds: [],
        },
      ],
    };

    const cycles = findCycleStepIds(document);

    expect(cycles).toEqual(new Set(["loop"]));
  });
});
