import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { SOPDocument } from "@sopflow/core";

import { SopWorkspace } from "./SopWorkspace.js";
import type { SopHeaderValue } from "../header/types.js";

const document: SOPDocument = {
  schemaVersion: "1",
  id: "workspace-sop",
  title: "Workspace SOP",
  actors: [{ id: "staff", name: "Staff" }],
  steps: [
    {
      id: "start",
      type: "start",
      name: "Mulai",
      actorIds: ["staff"],
      next: "task",
    },
    {
      id: "task",
      type: "task",
      name: "Review",
      actorIds: ["staff"],
      next: "end",
    },
    {
      id: "end",
      type: "end",
      name: "Selesai",
      actorIds: ["staff"],
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

describe("SopWorkspace", () => {
  it("opens the step editor inside the document", async () => {
    const user = userEvent.setup();
    render(<WorkspaceHarness />);

    expect(
      globalThis.document.querySelector("[data-sopflow-procedure-view]"),
    ).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Edit langkah" }));

    expect(screen.getAllByDisplayValue("Review")[0]).toBeInTheDocument();
    expect(
      globalThis.document.querySelector("[data-sopflow-procedure-view]"),
    ).toBeNull();
  });

  it("preserves step selection between preview and inline editing", async () => {
    const user = userEvent.setup();
    render(<WorkspaceHarness />);

    const previewNode = globalThis.document.querySelector<HTMLElement>(
      '[data-sopflow-procedure-step-id="task"]',
    );
    if (!previewNode) throw new Error("Review preview node not found");

    await user.click(previewNode);
    await user.click(screen.getByRole("button", { name: "Edit langkah" }));

    const editRow = globalThis.document.querySelector<HTMLElement>(
      '[data-sopflow-step-id="task"]',
    );
    expect(editRow).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("button", { name: "Preview" }));

    expect(
      globalThis.document.querySelector(
        '[data-sopflow-procedure-step-id="task"]',
      ),
    ).toHaveAttribute("aria-selected", "true");
  });
});
