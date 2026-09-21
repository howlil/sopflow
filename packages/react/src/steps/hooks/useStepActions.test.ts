import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DecisionStep, SOPDocument } from "@sopflow/core";

import { useStepActions } from "./useStepActions.js";

function createDocument(
  yes: string,
  no: string,
): {
  document: SOPDocument;
  decision: DecisionStep;
} {
  const decision: DecisionStep = {
    id: "decision",
    type: "decision",
    name: "Approved?",
    actorIds: [],
    yes,
    no,
  };

  return {
    decision,
    document: {
      schemaVersion: "1",
      id: "decision-test",
      title: "Decision test",
      actors: [],
      steps: [
        {
          id: "start",
          type: "start",
          name: "Start",
          actorIds: [],
          next: decision.id,
        },
        decision,
        {
          id: "approved",
          type: "task",
          name: "Approved",
          actorIds: [],
          next: "end",
        },
        {
          id: "rejected",
          type: "task",
          name: "Rejected",
          actorIds: [],
          next: "end",
        },
        {
          id: "end",
          type: "end",
          name: "End",
          actorIds: [],
        },
      ],
    },
  };
}

describe("useStepActions", () => {
  it("does not collapse divergent decision branches into a task", () => {
    const { document, decision } = createDocument("approved", "rejected");
    const onOperation = vi.fn();

    const { result } = renderHook(() =>
      useStepActions({
        step: decision,
        document,
        onOperation,
        onOperations: vi.fn(),
      }),
    );

    act(() => {
      result.current.changeStepType("task");
    });

    expect(onOperation).not.toHaveBeenCalled();
  });

  it("converts a decision to task when both branches already converge", () => {
    const { document, decision } = createDocument("end", "end");
    const onOperation = vi.fn();

    const { result } = renderHook(() =>
      useStepActions({
        step: decision,
        document,
        onOperation,
        onOperations: vi.fn(),
      }),
    );

    act(() => {
      result.current.changeStepType("task");
    });

    expect(onOperation).toHaveBeenCalledWith({
      type: "update-step",
      step: expect.objectContaining({
        id: "decision",
        type: "task",
        next: "end",
      }),
    });
  });
});
