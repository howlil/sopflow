import { render, within } from "@testing-library/react";
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
      actorIds: [],
      next: "task",
    },
    {
      id: "task",
      type: "task",
      name: "Proses",
      actorIds: ["staff"],
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
  it("keeps A4 header presentation separate from editable inspector controls", () => {
    const { container } = render(<Harness />);

    const main = container.querySelector("[data-sopflow-main-pane]");
    const inspector = container.querySelector("[data-sopflow-inspector]");
    const headerView = container.querySelector("[data-sopflow-header-view]");

    expect(main).not.toBeNull();
    expect(inspector).not.toBeNull();
    expect(headerView).not.toBeNull();
    expect(headerView?.querySelector("input, textarea, button")).toBeNull();

    expect(
      within(inspector as HTMLElement).getByLabelText("Nomor SOP"),
    ).toBeInTheDocument();
    expect(
      within(inspector as HTMLElement).getByRole("textbox", {
        name: "Nama pelaksana 1",
      }),
    ).toHaveValue("Staff");

    expect(within(headerView as HTMLElement).getByText("Layout SOP")).toBeInTheDocument();
  });
});
