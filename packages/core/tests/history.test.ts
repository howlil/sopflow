import { describe, expect, it } from "vitest";
import { exampleSop } from "../src/example.js";
import type { SOPDocument } from "../src/types.js";
import {
  applyHistoryOperation,
  applyHistoryOperations,
  applyValidatedHistoryOperations,
  createHistory,
  redo,
  undo,
} from "../src/history.js";

const linearDocument: SOPDocument = {
  schemaVersion: "1",
  id: "linear-sop",
  title: "Linear SOP",
  actors: [],
  steps: [
    {
      id: "start",
      type: "start",
      name: "Mulai",
      actorIds: [],
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

describe("createHistory", () => {
  it("creates history with document as present", () => {
    const history = createHistory(exampleSop);

    expect(history.present).toBe(exampleSop);
    expect(history.past).toEqual([]);
    expect(history.future).toEqual([]);
  });
});

describe("applyHistoryOperation", () => {
  it("applies operation and stores previous document", () => {
    const history = createHistory(exampleSop);

    const next = applyHistoryOperation(history, {
      type: "add-step",
      step: {
        id: "archive",
        type: "task",
        name: "Archive document",
        actorIds: ["staff"],
        next: "end",
      },
    });
    expect(next.present.steps.some((step) => step.id === "archive")).toBe(true);
    expect(next.past).toHaveLength(1);
    expect(next.past[0]).toBe(exampleSop);
    expect(next.future).toEqual([]);
  });
});

describe("applyHistoryOperations", () => {
  it("does not record an empty batch", () => {
    const history = createHistory(exampleSop);

    expect(applyHistoryOperations(history, [])).toBe(history);
  });

  it("stores a batch of operations as one undoable change", () => {
    const history = createHistory(exampleSop);

    const changed = applyHistoryOperations(history, [
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

    expect(changed.present.steps.some((step) => step.id === "archive")).toBe(
      true,
    );
    expect(changed.past).toHaveLength(1);
    expect(undo(changed).present).toBe(exampleSop);
  });

  it("records insertion and rewiring as one history entry", () => {
    const changed = applyHistoryOperations(createHistory(linearDocument), [
      {
        type: "insert-step",
        afterStepId: "start",
        step: {
          id: "task",
          type: "task",
          name: "Review",
          actorIds: [],
          next: "end",
        },
      },
      { type: "connect", from: "start", to: "task" },
    ]);

    expect(changed.past).toHaveLength(1);
    expect(changed.future).toHaveLength(0);
    expect(changed.present.steps.map((step) => step.id)).toEqual([
      "start",
      "task",
      "end",
    ]);
  });

  it("undoes the complete batch in one step", () => {
    const changed = applyHistoryOperations(createHistory(linearDocument), [
      {
        type: "insert-step",
        afterStepId: "start",
        step: {
          id: "task",
          type: "task",
          name: "Review",
          actorIds: [],
          next: "end",
        },
      },
      { type: "connect", from: "start", to: "task" },
    ]);

    const restored = undo(changed);

    expect(restored.present).toEqual(linearDocument);
    expect(restored.future).toHaveLength(1);
  });

  it("redoes the complete batch", () => {
    const changed = applyHistoryOperations(createHistory(linearDocument), [
      {
        type: "insert-step",
        afterStepId: "start",
        step: {
          id: "task",
          type: "task",
          name: "Review",
          actorIds: [],
          next: "end",
        },
      },
      { type: "connect", from: "start", to: "task" },
    ]);

    const restored = redo(undo(changed));

    expect(restored.present.steps.map((step) => step.id)).toEqual([
      "start",
      "task",
      "end",
    ]);
    expect(restored.future).toHaveLength(0);
  });

  it("clears redo history after a new batch edit", () => {
    const changed = applyHistoryOperations(createHistory(linearDocument), [
      {
        type: "insert-step",
        afterStepId: "start",
        step: {
          id: "task",
          type: "task",
          name: "Review",
          actorIds: [],
          next: "end",
        },
      },
      { type: "connect", from: "start", to: "task" },
    ]);

    const undone = undo(changed);
    const next = applyHistoryOperations(undone, [
      {
        type: "update-step",
        step: {
          id: "start",
          type: "start",
          name: "Mulai baru",
          actorIds: [],
          next: "end",
        },
      },
    ]);

    expect(undone.future).toHaveLength(1);
    expect(next.future).toHaveLength(0);
  });
});

describe("applyValidatedHistoryOperations", () => {
  it("records a valid batch as one undoable change", () => {
    const history = createHistory(exampleSop);

    const changed = applyValidatedHistoryOperations(history, [
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

    expect(changed.past).toHaveLength(1);
    expect(changed.present.steps.some((step) => step.id === "archive")).toBe(
      true,
    );
  });

  it("does not create history when the final state is invalid", () => {
    const history = createHistory(exampleSop);

    expect(() =>
      applyValidatedHistoryOperations(history, [
        { type: "connect", from: "approve-document", to: "start" },
      ]),
    ).toThrow("Operation would produce an invalid SOP document");
    expect(history.present).toBe(exampleSop);
    expect(history.past).toEqual([]);
  });
});

describe("undo", () => {
  it("restore previous document", () => {
    const history = createHistory(exampleSop);

    const changed = applyHistoryOperation(history, {
      type: "add-step",
      step: {
        id: "archive",
        type: "task",
        name: "Archive document",
        actorIds: ["staff"],
        next: "end",
      },
    });

    const undone = undo(changed);

    expect(undone.present.steps.some((step) => step.id === "archive")).toBe(
      false,
    );
    expect(undone.future).toHaveLength(1);
  });

  it("does nothing when there is nothing to undo", () => {
    const history = createHistory(exampleSop);

    expect(undo(history)).toBe(history);
  });
});

describe("redo", () => {
  it("restore undone document", () => {
    const history = createHistory(exampleSop);

    const changed = applyHistoryOperation(history, {
      type: "add-step",
      step: {
        id: "archive",
        type: "task",
        name: "Archive document",
        actorIds: ["staff"],
        next: "end",
      },
    });

    const undone = undo(changed);
    const redone = redo(undone);

    expect(redone.present.steps.some((step) => step.id === "archive")).toBe(
      true,
    );
    expect(redone.future).toEqual([]);
  });

  it("clears redo history when new operation is applied after undo", () => {
    let history = createHistory(exampleSop);

    history = applyHistoryOperation(history, {
      type: "add-step",

      step: {
        id: "archive",
        type: "task",
        name: "Archive",
        actorIds: ["staff"],
        next: "end",
      },
    });

    history = undo(history);

    expect(history.future).toHaveLength(1);

    history = applyHistoryOperation(history, {
      type: "add-step",

      step: {
        id: "notify",
        type: "task",
        name: "Notify user",
        actorIds: ["staff"],
        next: "end",
      },
    });

    expect(history.future).toEqual([]);
  });
});
