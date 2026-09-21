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
  it("opens the procedure editor inside the document", async () => {
    const user = userEvent.setup();
    render(<WorkspaceHarness />);

    expect(
      globalThis.document.querySelector("[data-sopflow-procedure-view]"),
    ).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Langkah" }));

    expect(screen.getByDisplayValue("Review")).toBeInTheDocument();
    expect(globalThis.document.querySelector("[data-sopflow-procedure-view]")).toBeNull();
  });

  it("preserves step selection between preview and inline editing", async () => {
    const user = userEvent.setup();
    render(<WorkspaceHarness />);

    const previewRow = globalThis.document.querySelector<HTMLElement>(
      '[data-sopflow-procedure-step-id="task"]',
    );
    if (!previewRow) throw new Error("Review preview row not found");

    await user.click(previewRow);
    await user.click(screen.getByRole("button", { name: "Langkah" }));

    const editRow = globalThis.document.querySelector<HTMLElement>(
      '[data-sopflow-step-id="task"]',
    );
    expect(editRow).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("button", { name: "Diagram" }));

    expect(
      globalThis.document.querySelector('[data-sopflow-procedure-step-id="task"]'),
    ).toHaveAttribute("aria-selected", "true");
  });
});
