import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import type { SOPDocument } from "@sopflow/core";
import type { SopHeaderValue } from "./header/types.js";
import { SopEditor } from "./SopEditor.js";

const document: SOPDocument = {
  schemaVersion: "1",
  id: "layout",
  title: "Layout SOP",
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
      name: "Proses",
      actorIds: ["staff"],
      input: "Formulir",
      duration: { value: 5, unit: "minute" },
      output: "Dokumen",
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
  number: "001",
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
    <SopEditor
      value={value}
      onChange={setValue}
      header={headerValue}
      onHeaderChange={setHeaderValue}
    />
  );
}

describe("SopEditor default composition", () => {
  it("keeps header and actors in the inspector while diagram controls live in the document", () => {
    const { container } = render(<Harness />);

    const main = container.querySelector("[data-sopflow-main-pane]");
    const canvasStage = container.querySelector("[data-sopflow-canvas-stage]");
    const inspector = container.querySelector("[data-sopflow-inspector]");
    const headerView = container.querySelector("[data-sopflow-header-view]");
    const flowchart = container.querySelector("[data-sopflow-flowchart]");
    const procedureView = container.querySelector(
      "[data-sopflow-procedure-view]",
    );

    expect(main).not.toBeNull();
    expect(canvasStage).not.toBeNull();
    expect(canvasStage?.parentElement).toBe(main);
    expect(
      canvasStage?.querySelector('[data-sopflow-page="a4"]'),
    ).not.toBeNull();
    expect(inspector).not.toBeNull();
    expect(headerView).not.toBeNull();
    expect(flowchart).toBeNull();
    expect(procedureView).not.toBeNull();

    expect(
      within(main as HTMLElement).getByRole("button", { name: "Preview" }),
    ).toBeInTheDocument();
    expect(
      within(main as HTMLElement).getByRole("button", {
        name: "Edit langkah",
      }),
    ).toBeInTheDocument();
    expect(
      within(main as HTMLElement).getByRole("button", { name: "Edit Manual" }),
    ).toBeInTheDocument();
    expect(
      within(main as HTMLElement).getByRole("tab", { name: "Flowchart" }),
    ).toBeInTheDocument();
    expect(
      within(main as HTMLElement).getByRole("tab", { name: "BPMN" }),
    ).toBeInTheDocument();

    expect(
      within(inspector as HTMLElement).getByLabelText("Nomor SOP"),
    ).toBeInTheDocument();
    expect(
      within(inspector as HTMLElement).getByRole("textbox", {
        name: "Nama pelaksana 1",
      }),
    ).toHaveValue("Staff");
    expect(
      within(inspector as HTMLElement).queryByLabelText("Kegiatan"),
    ).not.toBeInTheDocument();

    expect(
      within(headerView as HTMLElement).getByText("Layout SOP"),
    ).toBeInTheDocument();
    expect(
      within(procedureView as HTMLElement).getByRole("table"),
    ).toBeInTheDocument();
  });

  it("switches to the inline step editor without changing the inspector", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    const main = container.querySelector("[data-sopflow-main-pane]");
    const inspector = container.querySelector("[data-sopflow-inspector]");

    await user.click(
      within(main as HTMLElement).getByRole("button", {
        name: "Edit langkah",
      }),
    );

    expect(
      within(main as HTMLElement).getByRole("button", { name: "Preview" }),
    ).toBeInTheDocument();
    expect(
      within(main as HTMLElement).getAllByDisplayValue("Proses")[0],
    ).toBeInTheDocument();
    expect(
      within(inspector as HTMLElement).queryByLabelText("Kegiatan"),
    ).not.toBeInTheDocument();
    expect(
      within(inspector as HTMLElement).getByLabelText("Nomor SOP"),
    ).toBeInTheDocument();
  });

  it("closes and reopens the property inspector without removing the document", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    const main = container.querySelector("[data-sopflow-main-pane]");

    await user.click(
      within(container).getByRole("button", {
        name: "Tutup panel properti",
      }),
    );

    expect(container.querySelector("[data-sopflow-inspector]")).toBeNull();
    expect(
      container.querySelector("[data-sopflow-header-view]"),
    ).not.toBeNull();
    expect(container.querySelector("[data-inspector-open]")).toHaveAttribute(
      "data-inspector-open",
      "false",
    );
    expect(
      within(main as HTMLElement).getByRole("button", {
        name: "Buka panel properti",
      }),
    ).toHaveFocus();

    await user.click(
      within(main as HTMLElement).getByRole("button", {
        name: "Buka panel properti",
      }),
    );

    expect(container.querySelector("[data-sopflow-inspector]")).not.toBeNull();
    expect(
      within(
        container.querySelector("[data-sopflow-inspector]") as HTMLElement,
      ).getByLabelText("Nomor SOP"),
    ).toBeInTheDocument();
  });

  it("opens the manual route editor separately from the flowchart preview", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    const main = container.querySelector("[data-sopflow-main-pane]");

    await user.click(
      within(main as HTMLElement).getByRole("button", {
        name: "Edit Manual",
      }),
    );

    expect(container.querySelector("[data-sopflow-flowchart]")).toBeNull();
    expect(
      container.querySelector(
        '[data-sopflow-procedure-view][data-manual-editing="true"]',
      ),
    ).not.toBeNull();

    await user.click(
      within(main as HTMLElement).getByRole("button", {
        name: "Edit Manual",
      }),
    );

    expect(container.querySelector("[data-sopflow-flowchart]")).toBeNull();
    expect(
      container.querySelector(
        '[data-sopflow-procedure-view][data-manual-editing="true"]',
      ),
    ).toBeNull();
  });

  it("switches the preview between Flowchart and BPMN", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    await user.click(screen.getByRole("tab", { name: "BPMN" }));

    expect(container.querySelector("[data-sopflow-bpmn]")).not.toBeNull();
    expect(screen.getByRole("tab", { name: "BPMN" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      container.querySelector(
        '[data-sopflow-diagram-panel][data-diagram-kind="bpmn"]',
      ),
    ).not.toBeNull();
  });

  it("moves between diagram tabs with arrow keys", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    const flowchartTab = screen.getByRole("tab", { name: "Flowchart" });

    flowchartTab.focus();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: "BPMN" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      container.querySelector(
        '[data-sopflow-diagram-panel][data-diagram-kind="bpmn"]',
      ),
    ).not.toBeNull();
  });
});
