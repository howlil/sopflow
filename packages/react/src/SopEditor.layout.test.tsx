import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import type { SOPDocument } from "@sopflow/core";
import type { SopHeaderValue } from "./types.js";
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
    const inspector = container.querySelector("[data-sopflow-inspector]");
    const headerView = container.querySelector("[data-sopflow-header-view]");
    const procedureView = container.querySelector(
      "[data-sopflow-procedure-view]",
    );

    expect(main).not.toBeNull();
    expect(inspector).not.toBeNull();
    expect(headerView).not.toBeNull();
    expect(procedureView).not.toBeNull();

    expect(
      within(main as HTMLElement).getByRole("button", { name: "Langkah" }),
    ).toBeInTheDocument();
    expect(
      within(main as HTMLElement).getByRole("button", { name: "Edit Manual" }),
    ).toBeInTheDocument();
    expect(
      within(main as HTMLElement).getByRole("button", { name: "Flowchart" }),
    ).toBeInTheDocument();
    expect(
      within(main as HTMLElement).getByRole("button", { name: "BPMN" }),
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
      within(procedureView as HTMLElement).getByText("Formulir"),
    ).toBeInTheDocument();
    expect(
      within(procedureView as HTMLElement).getByText("5 menit"),
    ).toBeInTheDocument();
  });

  it("switches to the inline procedure editor without changing the inspector", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    const main = container.querySelector("[data-sopflow-main-pane]");
    const inspector = container.querySelector("[data-sopflow-inspector]");

    await user.click(
      within(main as HTMLElement).getByRole("button", { name: "Langkah" }),
    );

    expect(
      within(main as HTMLElement).getByRole("button", { name: "Diagram" }),
    ).toBeInTheDocument();
    expect(
      within(main as HTMLElement).getByDisplayValue("Proses"),
    ).toBeInTheDocument();
    expect(
      within(inspector as HTMLElement).queryByLabelText("Kegiatan"),
    ).not.toBeInTheDocument();
    expect(
      within(inspector as HTMLElement).getByLabelText("Nomor SOP"),
    ).toBeInTheDocument();
  });

  it("switches the preview between Flowchart and BPMN", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    await user.click(screen.getByRole("button", { name: "BPMN" }));

    expect(container.querySelector("[data-sopflow-bpmn]")).not.toBeNull();
    expect(screen.getByRole("button", { name: "BPMN" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
