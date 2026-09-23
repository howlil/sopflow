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

  it("renders one primary shape per step using sop-ta geometry", () => {
    const { container } = render(<SopProcedureView document={document} />);
    const reviewRow = container.querySelector(
      '[data-sopflow-procedure-step-id="review"]',
    );

    if (!reviewRow) throw new Error("review row not found");

    expect(
      reviewRow.querySelectorAll("[data-sopflow-primary-shape='review']"),
    ).toHaveLength(1);

    const decision = reviewRow.querySelector<SVGElement>(
      "svg[data-kind='decision']",
    );
    expect(decision).not.toBeNull();
    expect(decision).toHaveAttribute("width", "66");
    expect(decision).toHaveAttribute("height", "66");
    expect(decision).toHaveAttribute("viewBox", "-2 -2 64 64");
    expect(decision?.querySelector("polygon")).toHaveAttribute(
      "points",
      "30,1 59,30 30,59 1,30",
    );

    const start = container.querySelector<SVGElement>("svg[data-kind='start']");
    expect(start).toHaveAttribute("width", "86");
    expect(start).toHaveAttribute("height", "42");

    expect(
      within(reviewRow as HTMLElement).getByText("Valid?"),
    ).toBeInTheDocument();
  });

  it("keeps edges for an unassigned row by using the explicit fallback lane", () => {
    const unassignedDocument: SOPDocument = {
      ...document,
      steps: document.steps.map((step) =>
        step.id === "review" ? { ...step, actorIds: [] } : step,
      ),
    };
    const { container } = render(
      <SopProcedureView document={unassignedDocument} manualEditing />,
    );

    const reviewRow = container.querySelector(
      '[data-sopflow-procedure-step-id="review"]',
    );
    const overlay = container.querySelector('svg[data-editing="true"]');

    expect(
      reviewRow?.querySelector(
        '[data-sopflow-actor-id="fallback"] svg[data-kind="decision"]',
      ),
    ).not.toBeNull();
    expect(overlay).not.toBeNull();
    expect(overlay?.querySelectorAll("path").length).toBeGreaterThan(0);
  });
});
