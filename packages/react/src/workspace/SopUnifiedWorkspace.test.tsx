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
    {
      id: "start",
      type: "start",
      name: "Mulai",
      actorIds: ["staff"],
      next: "end",
    },
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
    expect(
      container.querySelector("[data-sopflow-steps-scroll]"),
    ).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Flowchart" }));
    expect(
      container.querySelector("[data-sopflow-procedure-view]"),
    ).not.toBeNull();
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
      container.querySelector(
        '[data-sopflow-procedure-view][data-manual-editing="true"]',
      ),
    ).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Steps" }));
    expect(screen.queryByRole("button", { name: "Edit routes" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Flowchart" }));
    expect(
      container.querySelector(
        '[data-sopflow-procedure-view][data-manual-editing="true"]',
      ),
    ).toBeNull();
  });

  it("shows real readiness issues in the persistent Problems footer", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    const toggle = screen.getByRole("button", { name: /Problems/ });

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle.textContent).toContain("Problems");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("button", { name: /Dasar hukum harus diisi/ }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close Problems" }));
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(container.querySelector("[data-sopflow-problems]")).not.toBeNull();
  });

  it("navigates to an empty required header list using its Add button", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await user.click(screen.getByRole("button", { name: /Problems/ }));
    await user.click(
      screen.getByRole("button", { name: /Dasar hukum harus diisi/ }),
    );

    const target = container.querySelector(
      '[data-sopflow-header-field="lawBasis"]',
    );
    expect(target).not.toBeNull();
    expect(target).toHaveFocus();
    expect(container.querySelector("[data-sopflow-inspector]")).not.toBeNull();
  });

  it("navigates procedure issues to their selected step in Steps mode", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await user.click(screen.getByRole("button", { name: /Problems/ }));
    await user.click(
      screen.getByRole("button", {
        name: /Langkah 1: kelengkapan wajib diisi/,
      }),
    );
    expect(screen.getByRole("button", { name: "Steps" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      container.querySelector(
        '[data-sopflow-step-id="start"][data-selected="true"]',
      ),
    ).not.toBeNull();
  });

  it("keeps runtime errors visible in Problems when the footer is expanded", async () => {
    const user = userEvent.setup();
    render(
      <SopUnifiedWorkspace
        value={document}
        header={header}
        error="Failed to build diagram"
      />,
    );
    await user.click(screen.getByRole("button", { name: /Problems/ }));
    expect(screen.getByText("Diagram error")).toBeInTheDocument();
    expect(
      screen.getAllByText("Failed to build diagram").length,
    ).toBeGreaterThan(0);
  });

  it("updates the issue list when a missing header requirement is completed", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: /Problems/ }));
    expect(
      screen.getByRole("button", { name: /Dasar hukum harus diisi/ }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Tambah dasar hukum" }),
    );
    await user.type(
      screen.getByRole("textbox", { name: "Dasar hukum 1" }),
      "Regulation 1",
    );
    expect(
      screen.queryByRole("button", { name: /Dasar hukum harus diisi/ }),
    ).toBeNull();
  });

  it("provides distinct Problems targets when two workspaces are embedded", async () => {
    const user = userEvent.setup();
    render(
      <>
        <SopUnifiedWorkspace value={document} header={header} />
        <SopUnifiedWorkspace value={document} header={header} />
      </>,
    );
    const toggles = screen.getAllByRole("button", { name: /Problems/ });
    const [firstToggle, secondToggle] = toggles;
    if (!firstToggle || !secondToggle)
      throw new Error("Missing Problems controls");
    await user.click(firstToggle);
    await user.click(secondToggle);
    const first = firstToggle.getAttribute("aria-controls");
    const second = secondToggle.getAttribute("aria-controls");
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(first).not.toBe(second);
    if (!first || !second) throw new Error("Missing Problems list IDs");
    expect(window.document.getElementById(first)).not.toBeNull();
    expect(window.document.getElementById(second)).not.toBeNull();
  });

  it("focuses an existing blank header-list entry rather than the Add button", async () => {
    const user = userEvent.setup();
    render(
      <SopUnifiedWorkspace
        value={document}
        header={{ ...header, lawBasis: [""] }}
        onHeaderChange={() => {}}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Problems/ }));
    await user.click(
      screen.getByRole("button", { name: /Dasar hukum harus diisi/ }),
    );
    expect(
      screen.getByRole("textbox", { name: "Dasar hukum 1" }),
    ).toHaveFocus();
  });

  it("zooms canvas without changing the physical A4 document", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    const paper = container.querySelector('[data-sopflow-page="a4"]');
    const canvas = container.querySelector("[data-sopflow-canvas-stage]");
    expect(paper).not.toBeNull();
    expect(canvas).not.toBeNull();
    expect(canvas).toHaveAttribute("data-preview-scale", "1");

    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(canvas).toHaveAttribute("data-preview-scale", "1.1");
    expect(
      (canvas as HTMLElement).style.getPropertyValue("--sopflow-preview-scale"),
    ).toBe("1.1");
    expect(paper).toHaveAttribute("data-sopflow-page", "a4");
    expect(
      screen.getByRole("button", { name: "Fit to viewport" }),
    ).toHaveTextContent("110%");
    await user.click(screen.getByRole("button", { name: "Fit to viewport" }));
    expect(canvas).toHaveAttribute("data-preview-scale", "1");
  });

  it("clamps manual zoom to a safe preview range", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    for (let i = 0; i < 25; i++) {
      await user.click(screen.getByRole("button", { name: "Zoom in" }));
    }
    expect(
      container.querySelector("[data-sopflow-canvas-stage]"),
    ).toHaveAttribute("data-preview-scale", "2");
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(
      container.querySelector("[data-sopflow-canvas-stage]"),
    ).toHaveAttribute("data-preview-scale", "1.9");
  });

  it("supports keyboard inspector resizing without shifting canvas state", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    // JSDOM has no layout; provide the host width used by the resize guard.
    const dragHost = container
      .querySelector("[data-sopflow-unified-workspace]")
      ?.querySelector("[data-sopflow-inspector-resize]")?.parentElement;
    if (!dragHost) throw new Error("Workspace resize host missing");
    Object.defineProperty(dragHost, "clientWidth", {
      configurable: true,
      value: 900,
    });
    const resize = screen.getByRole("separator", { name: "Resize Properties" });
    expect(resize).toHaveAttribute("aria-valuenow", "258");
    resize.focus();
    await user.keyboard("{ArrowLeft}");
    expect(resize).toHaveAttribute("aria-valuenow", "268");
    await user.keyboard("{ArrowRight}");
    expect(resize).toHaveAttribute("aria-valuenow", "258");
    expect(container.querySelector('[data-sopflow-page="a4"]')).not.toBeNull();
  });
});
