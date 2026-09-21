import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SOPDocument } from "@sopflow/core";
import { SopProcedureView } from "./SopProcedureView.js";

const document: SOPDocument = {
  schemaVersion: "1",
  id: "procedure",
  title: "Procedure",
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
      actorIds: ["front-office", "manager"],
      yes: "end",
      no: "start",
      input: "Dokumen",
      duration: { value: 11, unit: "minute" },
      output: "Hasil",
      note: "Catatan",
    },
    {
      id: "end",
      type: "end",
      name: "Selesai",
      actorIds: ["manager"],
    },
  ],
};

describe("SopProcedureView", () => {
  it("renders SOP-AP grouped actor and mutu baku headers", () => {
    render(<SopProcedureView document={document} />);

    expect(screen.getByText("Pelaksana")).toHaveAttribute("colspan", "2");
    expect(screen.getByText("Mutu Baku")).toHaveAttribute("colspan", "3");
    expect(screen.getByText("Front Office")).toBeInTheDocument();
    expect(screen.getByText("Manager")).toBeInTheDocument();
    expect(screen.getByText("11 menit")).toBeInTheDocument();
  });

  it("renders flow connections as an overlay on the SOP-AP matrix", async () => {
    const { container } = render(
      <SopProcedureView document={document} manualEditing />,
    );

    const overlay = container.querySelector('svg[data-editing="true"]');
    expect(overlay).not.toBeNull();
    expect(overlay?.querySelectorAll("path").length).toBeGreaterThan(1);
  });

  it("marks every assigned actor cell for multi-actor steps", () => {
    const { container } = render(<SopProcedureView document={document} />);
    const row = container.querySelector(
      '[data-sopflow-procedure-step-id="review"]',
    );

    if (!row) throw new Error("review row not found");

    const frontOffice = row.querySelector(
      '[data-sopflow-actor-id="front-office"]',
    );
    const manager = row.querySelector('[data-sopflow-actor-id="manager"]');

    expect(
      frontOffice?.querySelector("svg[data-kind='decision']"),
    ).not.toBeNull();
    expect(manager?.querySelector("svg[data-kind='decision']")).not.toBeNull();
    expect(within(row as HTMLElement).getByText("Valid?")).toBeInTheDocument();
  });
});
