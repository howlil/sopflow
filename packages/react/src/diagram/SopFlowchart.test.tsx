import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SOPDocument } from "@sopflow/core";
import { SopFlowchart } from "./SopFlowchart.js";

const document: SOPDocument = {
  schemaVersion: "1",
  id: "flowchart",
  title: "Flowchart SOP",
  actors: [
    { id: "front-office", name: "Front Office" },
    { id: "manager", name: "Manager" },
  ],
  steps: [
    {
      id: "start",
      type: "start",
      name: "Mulai",
      actorIds: ["front-office"],
      next: "review",
    },
    {
      id: "review",
      type: "decision",
      name: "Valid?",
      actorIds: ["manager"],
      yes: "end",
      no: "start",
    },
    {
      id: "end",
      type: "end",
      name: "Selesai",
      actorIds: ["manager"],
    },
  ],
};

describe("SopFlowchart", () => {
  it("renders actor lanes and workflow shapes", () => {
    const { container } = render(<SopFlowchart document={document} fit={false} />);

    expect(
      screen.getByRole("img", { name: "Flowchart SOP Flowchart SOP" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Front Office")).toBeInTheDocument();
    expect(screen.getByText("Manager")).toBeInTheDocument();
    expect(screen.getByText("Ya")).toBeInTheDocument();
    expect(screen.getByText("Tidak")).toBeInTheDocument();
    expect(container.querySelector("polygon")).not.toBeNull();
  });

  it("shares step selection through the same controlled contract", () => {
    const onSelectedStepChange = vi.fn();

    render(
      <SopFlowchart
        document={document}
        selectedStepId="review"
        onSelectedStepChange={onSelectedStepChange}
        fit={false}
      />,
    );

    const review = screen.getByRole("button", { name: "Valid? (decision)" });
    expect(review).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Selesai (end)" }));
    expect(onSelectedStepChange).toHaveBeenCalledWith("end");
  });
});
