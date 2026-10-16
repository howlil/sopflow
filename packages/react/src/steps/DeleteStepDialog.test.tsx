import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
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
  it("filters replacement targets that would make the final workflow invalid", async () => {
    const user = userEvent.setup();
    render(
      <DeleteStepDialog
        open
        step={task}
        document={document}
        onClose={vi.fn()}
        onOperations={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("combobox", {
        name: /sambungkan langkah sebelumnya ke/i,
      }),
    );
    const options = within(screen.getByRole("listbox"));
    expect(options.getByRole("option", { name: /End/i })).toBeInTheDocument();
    expect(options.queryByRole("option", { name: /Start/i })).toBeNull();
    expect(options.queryByRole("option", { name: /^2\. A$/i })).toBeNull();
  });
});
