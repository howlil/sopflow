import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { SOPDocument, StepId } from "@sopflow/core";

import { SopEditor } from "../SopEditor.js";
import type { SopHeaderValue } from "../types.js";
import { SopDiagram } from "./SopDiagram.js";

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

function dispatchPointerEvent(
  element: HTMLElement,
  type: "pointerdown" | "pointermove",
  init: {
    button?: number;
    clientX?: number;
    clientY?: number;
    pointerId: number;
  },
) {
  const event = new Event(type, { bubbles: true });
  for (const [key, value] of Object.entries(init)) {
    Object.defineProperty(event, key, {
      configurable: true,
      value,
    });
  }
  element.dispatchEvent(event);
}

const decisionDocument: SOPDocument = {
  schemaVersion: "1",
  id: "diagram-sop",
  title: "Decision SOP",
  actors: [],
  steps: [
    {
      id: "start",
      type: "start",
      name: "Mulai",
      actorIds: [],
      next: "decision",
    },
    {
      id: "decision",
      type: "decision",
      name: "Disetujui?",
      actorIds: [],
      yes: "approve",
      no: "reject",
    },
    {
      id: "approve",
      type: "task",
      name: "Setujui",
      actorIds: [],
      next: "end",
    },
    {
      id: "reject",
      type: "task",
      name: "Tolak",
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

describe("SopDiagram", () => {
  it("renders a clear empty state without a zero-sized SVG", () => {
    const emptyDocument: SOPDocument = {
      ...decisionDocument,
      steps: [],
    };

    render(<SopDiagram document={emptyDocument} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Belum ada diagram SOP.",
    );
    expect(document.querySelector("svg")).not.toBeInTheDocument();
  });

  it("keeps original SVG dimensions and viewBox when fit is disabled", () => {
    render(<SopDiagram document={decisionDocument} fit={false} />);

    const svg = screen.getByRole("img", { name: "Diagram SOP Decision SOP" });
    const viewBox = svg.getAttribute("viewBox");
    expect(viewBox).toMatch(/^0 0 \d+ \d+$/);
    const [, , viewBoxWidth, viewBoxHeight] = viewBox?.split(" ") ?? [];
    expect(svg).toHaveAttribute("width", viewBoxWidth);
    expect(svg).toHaveAttribute("height", viewBoxHeight);
  });

  it("renders an SVG with decision shapes and branch labels", () => {
    render(<SopDiagram document={decisionDocument} />);

    expect(
      screen.getByRole("img", { name: "Diagram SOP Decision SOP" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Disetujui?")).toBeInTheDocument();
    expect(screen.getByText("Ya")).toBeInTheDocument();
    expect(screen.getByText("Tidak")).toBeInTheDocument();
    expect(document.querySelector("polygon")).toBeInTheDocument();
    expect(document.querySelectorAll("path").length).toBeGreaterThan(0);
  });

  it("gives each diagram a unique arrow marker id", () => {
    const { container } = render(
      <>
        <SopDiagram document={decisionDocument} />
        <SopDiagram document={decisionDocument} />
      </>,
    );

    const markers = [...container.querySelectorAll("marker")];
    const ids = markers.map((marker) => marker.id);

    expect(new Set(ids).size).toBe(2);
    expect(ids.every((id) => id.length > 0)).toBe(true);
  });

  it("selects nodes by click and keyboard and exposes selected state", () => {
    const onSelectedStepChange = vi.fn();
    render(
      <SopDiagram
        document={decisionDocument}
        selectedStepId="decision"
        onSelectedStepChange={onSelectedStepChange}
      />,
    );

    const decision = screen.getByRole("button", {
      name: "Disetujui? (decision)",
    });
    expect(decision).toHaveAttribute("data-selected", "true");
    expect(decision).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Setujui (task)" }));
    expect(onSelectedStepChange).toHaveBeenCalledWith("approve");

    fireEvent.keyDown(decision, { key: "Enter" });
    expect(onSelectedStepChange).toHaveBeenCalledWith("decision");

    fireEvent.keyDown(decision, { key: " " });
    expect(onSelectedStepChange).toHaveBeenCalledTimes(3);
  });

  it("does not pan when pointerdown starts on a node", () => {
    render(<SopDiagram document={decisionDocument} />);

    const viewport = screen.getByTestId("sopflow-diagram-viewport");
    const node = screen.getByRole("button", { name: "Setujui (task)" });
    Object.defineProperties(viewport, {
      scrollLeft: { configurable: true, writable: true, value: 100 },
      scrollTop: { configurable: true, writable: true, value: 60 },
    });

    dispatchPointerEvent(node, "pointerdown", {
      pointerId: 1,
      button: 0,
      clientX: 100,
      clientY: 100,
    });
    dispatchPointerEvent(viewport, "pointermove", {
      pointerId: 1,
      clientX: 50,
      clientY: 70,
    });

    expect(viewport.scrollLeft).toBe(100);
    expect(viewport.scrollTop).toBe(60);
  });

  it("clears selection when the selected node is removed", async () => {
    const onSelectedStepChange = vi.fn();
    const { rerender } = render(
      <SopDiagram
        document={decisionDocument}
        selectedStepId="approve"
        onSelectedStepChange={onSelectedStepChange}
      />,
    );

    rerender(
      <SopDiagram
        document={{
          ...decisionDocument,
          steps: decisionDocument.steps.filter((step) => step.id !== "approve"),
        }}
        selectedStepId="approve"
        onSelectedStepChange={onSelectedStepChange}
      />,
    );

    await waitFor(() => {
      expect(onSelectedStepChange).toHaveBeenCalledWith(null);
    });
  });

  it("renders supplied wrapped lines as SVG tspans", () => {
    const longDocument: SOPDocument = {
      ...decisionDocument,
      steps: decisionDocument.steps.map((step) =>
        step.id === "approve"
          ? {
              ...step,
              name: "Verifikasi kelengkapan dokumen pengajuan",
            }
          : step,
      ),
    };

    render(<SopDiagram document={longDocument} selectedStepId="approve" />);

    const approve = screen.getByRole("button", {
      name: "Verifikasi kelengkapan dokumen pengajuan (task)",
    });
    expect(approve).toHaveAttribute("data-selected", "true");
    expect(approve.querySelectorAll("tspan").length).toBeGreaterThan(1);
  });

  it("synchronizes selection with SopEditor through the shared contract", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [selectedStepId, setSelectedStepId] = useState<StepId | null>(null);

      return (
        <>
          <SopEditor
            value={decisionDocument}
            header={header}
            selectedStepId={selectedStepId}
            onSelectedStepChange={setSelectedStepId}
          />
          <SopDiagram
            document={decisionDocument}
            selectedStepId={selectedStepId}
            onSelectedStepChange={setSelectedStepId}
          />
        </>
      );
    }

    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Setujui (task)" }));

    expect(
      document.querySelector('[data-sopflow-procedure-step-id="approve"]'),
    ).toHaveAttribute("data-selected", "true");

    const rejectRow = document.querySelector(
      '[data-sopflow-procedure-step-id="reject"]',
    );

    if (!rejectRow) {
      throw new Error("Expected the reject step row to be rendered");
    }

    await user.click(rejectRow);

    expect(
      screen.getByRole("button", { name: "Tolak (task)" }),
    ).toHaveAttribute("data-selected", "true");
  });
});
