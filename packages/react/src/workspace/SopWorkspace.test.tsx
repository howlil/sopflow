import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { SOPDocument } from "@sopflow/core";

import { SopWorkspace } from "./SopWorkspace.js";
import type { SopHeaderValue } from "../types.js";

const document: SOPDocument = {
  schemaVersion: "1",
  id: "workspace-sop",
  title: "Workspace SOP",
  actors: [],
  steps: [
    {
      id: "start",
      type: "start",
      name: "Mulai",
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
      name: "Selesai",
      actorIds: [],
    },
  ],
};

const header: SopHeaderValue = {
  number: "",
  institutionName: "",
  createdDate: "",
  revisionDate: "",
  effectiveDate: "",
  lawBasis: [],
  qualifications: [],
  relatedSops: [],
  equipment: [],
  warnings: [],
  records: [],
};

function WorkspaceHarness() {
  return <SopWorkspace value={document} header={header} />;
}

function getReviewInput() {
  const input = screen.getAllByDisplayValue("Review")[0];

  if (!input) {
    throw new Error("Review input not found");
  }

  return input;
}

describe("SopWorkspace", () => {
  it("preserves step selection between editor and diagram views", async () => {
    const user = userEvent.setup();

    render(<WorkspaceHarness />);

    await user.click(getReviewInput());
    await user.click(screen.getByRole("button", { name: "Diagram" }));

    expect(
      screen.getByRole("button", { name: "Review (task)" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("preserves diagram selection when returning to the editor", async () => {
    const user = userEvent.setup();

    render(<WorkspaceHarness />);

    await user.click(screen.getByRole("button", { name: "Diagram" }));
    await user.click(screen.getByRole("button", { name: "Review (task)" }));
    await user.click(screen.getByRole("button", { name: "Prosedur" }));

    const selectedRow = getReviewInput().closest("[data-sopflow-step-id]");

    if (!selectedRow) {
      throw new Error("Selected step row not found");
    }

    expect(selectedRow).toHaveAttribute("aria-selected", "true");
  });
});
