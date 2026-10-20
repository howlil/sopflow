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

    screen
      .getByRole("combobox", { name: /sambungkan langkah sebelumnya ke/i })
      .focus();
    await user.keyboard("{ArrowDown}");
    const options = within(await screen.findByRole("listbox"));
    expect(options.getByRole("option", { name: /^4\\. End$/i })).toBeInTheDocument();
    expect(options.queryByRole("option", { name: /Start/i })).toBeNull();
    expect(options.queryByRole("option", { name: /^2\. A$/i })).toBeNull();
  });

  it("renders its confirmation dialog in the document portal", () => {
    render(
      <DeleteStepDialog
        open
        step={task}
        document={document}
        onClose={vi.fn()}
        onOperations={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("alertdialog", { name: "Hapus langkah" });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("data-sopflow-root");
    expect(window.document.body.contains(dialog)).toBe(true);
  });
});
