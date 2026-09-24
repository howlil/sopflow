import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SOPDocument } from "@sopflow/core";
import { buildBpmnModel, type SopDiagramConfig } from "@sopflow/diagram";
import { SopBpmn } from "./SopBpmn.js";

const document: SOPDocument = {
  schemaVersion: "1",
  id: "bpmn",
  title: "BPMN SOP",
  actors: [
    { id: "staff", name: "Staff" },
    { id: "manager", name: "Manager" },
  ],
  steps: [
    {
      id: "start",
      type: "start",
      name: "Mulai",
      actorIds: ["staff"],
      next: "review",
    },
    {
      id: "review",
      type: "decision",
      name: "Valid?",
      actorIds: ["manager"],
      yes: "end",
      no: "fix",
    },
    {
      id: "fix",
      type: "task",
      name: "Perbaiki",
      actorIds: ["staff"],
      next: "review",
    },
    {
      id: "end",
      type: "end",
      name: "Selesai",
      actorIds: ["manager"],
    },
  ],
};

describe("SopBpmn", () => {
  it("renders actor lanes and BPMN-style step shapes", () => {
    const { container } = render(<SopBpmn document={document} />);

    expect(
      screen.getByRole("img", { name: "BPMN SOP BPMN SOP" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Staff")).toBeInTheDocument();
    expect(screen.getByText("Manager")).toBeInTheDocument();
    expect(container.querySelector("polygon")).not.toBeNull();
    expect(container.querySelectorAll("circle").length).toBeGreaterThanOrEqual(
      3,
    );
    expect(container.querySelector("rect")).not.toBeNull();
  });

  it("renders long BPMN labels across multiple lines without truncating content", () => {
    const longLabel =
      "Verifikasi dokumen pengajuan pembayaran dan kelengkapan administrasi";
    const longDocument: SOPDocument = {
      ...document,
      steps: document.steps.map((step) =>
        step.id === "fix" ? { ...step, name: longLabel } : step,
      ),
    };

    const { container } = render(<SopBpmn document={longDocument} />);
    const node = container.querySelector('[data-sopflow-step-id="fix"]');

    const lines = Array.from(node?.querySelectorAll("tspan") ?? []).map(
      (line) => line.textContent ?? "",
    );

    expect(lines.join(" ")).toBe(longLabel);
    expect(lines.join(" ")).not.toContain("…");
    expect(lines.length).toBeGreaterThan(1);
  });

  it("removes a selected persisted BPMN route through the manual editor", () => {
    const automatic = buildBpmnModel(document);
    const edge = automatic.edges.find(
      (candidate) => candidate.id === "start:next:review",
    );
    if (!edge?.sourceSide || !edge.targetSide) {
      throw new Error("automatic route fixture missing");
    }

    const config: SopDiagramConfig = {
      routes: {
        [edge.id]: {
          kind: "orthogonal",
          bendPoints: edge.points.slice(1, -1),
          sSide: edge.sourceSide,
          eSide: edge.targetSide,
          startPoint: edge.points[0],
          endPoint: edge.points.at(-1),
        },
      },
    };
    const onDiagramConfigChange = vi.fn();

    render(
      <SopBpmn
        document={document}
        manualEditing
        diagramConfig={config}
        onDiagramConfigChange={onDiagramConfigChange}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Edit route start:next:review" }),
    );
    fireEvent.keyDown(globalThis, { key: "Delete" });

    expect(onDiagramConfigChange).toHaveBeenCalledWith({});
  });

  it("uses the shared controlled selection contract", () => {
    const onSelectedStepChange = vi.fn();

    render(
      <SopBpmn
        document={document}
        selectedStepId="review"
        onSelectedStepChange={onSelectedStepChange}
      />,
    );

    const review = screen.getByRole("button", { name: "Valid? (decision)" });
    expect(review).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Perbaiki (task)" }));
    expect(onSelectedStepChange).toHaveBeenCalledWith("fix");
  });
});
