import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SOPDocument } from "@sopflow/core";
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
