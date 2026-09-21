import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Step } from "@sopflow/core";
import { StepTypeField } from "./StepTypeField.js";

const steps: Step[] = [
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
    name: "Valid?",
    actorIds: [],
    yes: "approve",
    no: "start",
  },
  {
    id: "approve",
    type: "task",
    name: "Setujui",
    actorIds: [],
    next: "end",
  },
  {
    id: "end",
    type: "end",
    name: "Selesai",
    actorIds: [],
  },
];

describe("StepTypeField", () => {
  it("shows decision branches using authoring row numbers", () => {
    render(
      <StepTypeField
        step={steps[1] as Step}
        steps={steps}
        onChange={() => undefined}
      />,
    );

    expect(screen.getByText("Ya → 3 · Tidak → 1")).toBeInTheDocument();
  });

  it("keeps start and end types fixed", () => {
    const { rerender } = render(
      <StepTypeField
        step={steps[0] as Step}
        steps={steps}
        onChange={() => undefined}
      />,
    );

    expect(screen.getByText("Mulai")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    rerender(
      <StepTypeField
        step={steps[3] as Step}
        steps={steps}
        onChange={() => undefined}
      />,
    );

    expect(screen.getByText("Selesai")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});
