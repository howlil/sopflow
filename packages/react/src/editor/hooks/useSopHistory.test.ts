import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SOPDocument } from "@sopflow/core";

import { useSopHistory } from "./useSopHistory.js";

const document: SOPDocument = {
  schemaVersion: "1",
  id: "history",
  title: "History",
  actors: [],
  steps: [
    {
      id: "start",
      type: "start",
      name: "Start",
      actorIds: [],
      next: "task",
    },
    {
      id: "task",
      type: "task",
      name: "Review",
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
};

describe("useSopHistory", () => {
  it("preserves undo history when a controlled parent clones the emitted value", () => {
    const onChange = vi.fn();

    const { result, rerender } = renderHook(
      ({ value }: { value: SOPDocument }) =>
        useSopHistory({ value, onChange }),
      {
        initialProps: { value: document },
      },
    );

    act(() => {
      result.current.applyOperation({
        type: "update-step",
        step: {
          id: "task",
          type: "task",
          name: "Reviewed",
          actorIds: [],
          next: "end",
        },
      });
    });

    expect(result.current.canUndo).toBe(true);

    const emitted = onChange.mock.lastCall?.[0] as SOPDocument | undefined;

    if (!emitted) {
      throw new Error("Expected an emitted document");
    }

    rerender({
      value: JSON.parse(JSON.stringify(emitted)) as SOPDocument,
    });

    expect(result.current.canUndo).toBe(true);

    act(() => {
      result.current.undo();
    });

    const restored = onChange.mock.lastCall?.[0] as SOPDocument | undefined;

    expect(
      restored?.steps.find((step) => step.id === "task")?.name,
    ).toBe("Review");
  });
});
