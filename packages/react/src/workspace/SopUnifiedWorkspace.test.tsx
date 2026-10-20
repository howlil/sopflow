import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import type { SOPDocument } from "@sopflow/core";
import type { SopHeaderValue } from "../header/types.js";
import { SopUnifiedWorkspace } from "./SopUnifiedWorkspace.js";

const document: SOPDocument = {
  schemaVersion: "1",
  id: "unified",
  title: "Pengajuan Dokumen",
  actors: [{ id: "staff", name: "Staff" }],
  steps: [
    { id: "start", type: "start", name: "Mulai", actorIds: ["staff"], next: "end" },
    { id: "end", type: "end", name: "Selesai", actorIds: ["staff"] },
  ],
};

const header: SopHeaderValue = {
  number: "SOP/001",
  institutionName: "Instansi",
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

function Harness() {
  const [value, setValue] = useState(document);
  const [headerValue, setHeaderValue] = useState(header);
  return (
    <SopUnifiedWorkspace
      value={value}
      onChange={setValue}
      header={headerValue}
      onHeaderChange={setHeaderValue}
      showValidationPanel={false}
    />
  );
}

describe("SopUnifiedWorkspace", () => {
  it("renders a single unified top bar outside the A4 document", () => {
    const { container } = render(<Harness />);
    const root = container.querySelector("[data-sopflow-unified-workspace]");
    expect(root).not.toBeNull();
    expect(
      within(root as HTMLElement).getByRole("button", { name: "Flowchart" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(root?.querySelector("[data-sopflow-document-toolbar]")).toBeNull();
    expect(root?.querySelector('[data-sopflow-page="a4"]')).not.toBeNull();
  });

  it("switches between flowchart, BPMN and Steps without losing the editor", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    await user.click(screen.getByRole("button", { name: "BPMN" }));
    expect(container.querySelector("[data-sopflow-bpmn]")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Steps" }));
    expect(container.querySelector("[data-sopflow-steps-scroll]")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Flowchart" }));
    expect(container.querySelector("[data-sopflow-procedure-view]")).not.toBeNull();
  });

  it("keeps properties controlled by the external toolbar", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    const toggle = screen.getByRole("button", { name: "Toggle Properties" });

    expect(container.querySelector("[data-sopflow-inspector]")).not.toBeNull();
    expect(
      screen.queryByRole("button", { name: "Tutup panel properti" }),
    ).toBeNull();

    await user.click(toggle);
    expect(container.querySelector("[data-sopflow-inspector]")).toBeNull();
    expect(toggle).toHaveFocus();

    await user.click(toggle);
    expect(container.querySelector("[data-sopflow-inspector]")).not.toBeNull();
    expect(toggle).toHaveFocus();
  });

  it("turns off route editing when moving into Steps", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Edit routes" }));
    expect(
      container.querySelector('[data-sopflow-procedure-view][data-manual-editing="true"]'),
    ).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Steps" }));
    expect(
      screen.queryByRole("button", { name: "Edit routes" }),
    ).toBeNull();

    await user.click(screen.getByRole("button", { name: "Flowchart" }));
    expect(
      container.querySelector('[data-sopflow-procedure-view][data-manual-editing="true"]'),
    ).toBeNull();
  });
});
