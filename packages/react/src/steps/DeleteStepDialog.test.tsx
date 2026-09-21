import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SOPDocument, TaskStep } from "@sopflow/core";

import { DeleteStepDialog } from "./DeleteStepDialog.js";

const task: TaskStep = {
  id: "b",
  type: "task",
  name: "B",
  actorIds: [],
  next: "end",
};

const document: SOPDocument = {
  schemaVersion: "1",
  id: "delete-test",
  title: "Delete test",
  actors: [],
  steps: [
    {
      id: "start",
      type: "start",
      name: "Start",
      actorIds: [],
      next: "a",
    },
    {
      id: "a",
      type: "task",
      name: "A",
      actorIds: [],
      next: "b",
    },
    task,
    {
      id: "end",
      type: "end",
      name: "End",
      actorIds: [],
    },
  ],
};

describe("DeleteStepDialog", () => {
  it("filters replacement targets that would make the final workflow invalid", () => {
    render(
      <DeleteStepDialog
        open
        step={task}
        document={document}
        onClose={vi.fn()}
        onOperations={vi.fn()}
      />,
    );

    const select = screen.getByLabelText(
      /sambungkan langkah sebelumnya ke/i,
    ) as HTMLSelectElement;
    const values = Array.from(select.options).map((option) => option.value);

    expect(values).toContain("end");
    expect(values).not.toContain("a");
    expect(values).not.toContain("start");
  });
});
