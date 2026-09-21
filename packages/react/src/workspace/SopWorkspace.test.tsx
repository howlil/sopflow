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

function getReviewRow() {
  const row = globalThis.document.querySelector<HTMLElement>(
    '[data-sopflow-procedure-step-id="task"]',
  );

  if (!row) {
    throw new Error("Review row not found");
  }

  return row;
}

describe("SopWorkspace", () => {
  it("preserves step selection between editor and diagram views", async () => {
    const user = userEvent.setup();

    render(<WorkspaceHarness />);

    await user.click(getReviewRow());
    await user.click(screen.getByRole("button", { name: "Flowchart" }));

    expect(
      screen.getByRole("button", { name: "Review (task)" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("preserves diagram selection when returning to the editor", async () => {
    const user = userEvent.setup();

    render(<WorkspaceHarness />);

    await user.click(screen.getByRole("button", { name: "Flowchart" }));
    await user.click(screen.getByRole("button", { name: "Review (task)" }));
    await user.click(screen.getByRole("button", { name: "Langkah" }));

    expect(getReviewRow()).toHaveAttribute("aria-selected", "true");
  });
});
