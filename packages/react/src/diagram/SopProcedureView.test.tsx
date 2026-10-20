import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
      actorIds: ["front-office"],
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
  it("retains a saved cross-page override when pagination becomes local", () => {
    const onDiagramConfigChange = vi.fn();
    const config = {
      pagedRoutes: {
        "start:next:review": { source: { kind: "trunk" as const, x: 320 } },
      },
    };
    const { rerender } = render(
      <SopProcedureView
        document={document}
        diagramConfig={config}
        onDiagramConfigChange={onDiagramConfigChange}
        firstPageRows={1}
        nextPageRows={1}
      />,
    );
    onDiagramConfigChange.mockClear();
    rerender(
      <SopProcedureView
        document={document}
        diagramConfig={config}
        onDiagramConfigChange={onDiagramConfigChange}
        firstPageRows={4}
        nextPageRows={4}
      />,
    );
    expect(onDiagramConfigChange).not.toHaveBeenCalled();
  });

  it("renders SOP-AP grouped actor and mutu baku headers", () => {
    render(<SopProcedureView document={document} />);

    expect(screen.getByText("Pelaksana")).toHaveAttribute("colspan", "2");
    expect(screen.getByText("Mutu Baku")).toHaveAttribute("colspan", "3");
    expect(screen.getByText("Front Office")).toBeInTheDocument();
    expect(screen.getByText("Manager")).toBeInTheDocument();
    expect(screen.getByText("11 menit")).toBeInTheDocument();
  });

  it("uses the page renderer for single-page manual editing", () => {
    const { container } = render(
      <SopProcedureView document={document} manualEditing />,
    );

    expect(
      container.querySelector("[data-sopflow-procedure-pages='1']"),
    ).not.toBeNull();
    expect(
      container.querySelector(
        "[data-sopflow-procedure-page='0'][data-manual-editing='true']",
      ),
    ).not.toBeNull();
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
    expect(
      reviewRow?.querySelector(
        '[data-sopflow-actor-id="fallback"] svg[data-kind="decision"]',
      ),
    ).not.toBeNull();
    expect(
      container.querySelector("[data-sopflow-procedure-page='0']"),
    ).not.toBeNull();
  });

  it("renders legacy multi-actor steps only in the fallback column", () => {
    const conflicting: SOPDocument = {
      ...document,
      steps: document.steps.map((step) =>
        step.id === "review"
          ? { ...step, actorIds: ["front-office", "manager"] }
          : step,
      ),
    };
    const { container } = render(
      <SopProcedureView document={conflicting} manualEditing />,
    );
    const reviewRow = container.querySelector(
      '[data-sopflow-procedure-step-id="review"]',
    );
    expect(reviewRow).not.toBeNull();
    expect(
      reviewRow?.querySelectorAll('[data-sopflow-primary-shape="review"]'),
    ).toHaveLength(1);
    expect(
      reviewRow?.querySelector(
        '[data-sopflow-actor-id="fallback"] svg[data-kind="decision"]',
      ),
    ).not.toBeNull();
    expect(
      reviewRow?.querySelector(
        '[data-sopflow-actor-id="front-office"] svg[data-kind="decision"]',
      ),
    ).toBeNull();
  });

  it("renders long procedures as pages with off-page connectors", () => {
    const longDocument: SOPDocument = {
      schemaVersion: "1",
      id: "long-procedure",
      title: "Long Procedure",
      actors: [{ id: "staff", name: "Staff" }],
      steps: Array.from({ length: 6 }, (_, index) => {
        const number = index + 1;
        const id = `step-${number}`;

        if (number === 1) {
          return {
            id,
            type: "start" as const,
            name: `Step ${number}`,
            actorIds: ["staff"],
            next: "step-2",
          };
        }

        if (number === 6) {
          return {
            id,
            type: "end" as const,
            name: `Step ${number}`,
            actorIds: ["staff"],
          };
        }

        return {
          id,
          type: "task" as const,
          name: `Step ${number}`,
          actorIds: ["staff"],
          next: `step-${number + 1}`,
        };
      }),
    };

    const { container } = render(
      <SopProcedureView
        document={longDocument}
        firstPageRows={2}
        nextPageRows={2}
      />,
    );

    expect(
      container.querySelector("[data-sopflow-procedure-pages='3']"),
    ).not.toBeNull();
    expect(
      container.querySelectorAll("[data-sopflow-procedure-page]"),
    ).toHaveLength(3);
    expect(
      container.querySelectorAll("[data-sopflow-opc]").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Step 6")).toBeInTheDocument();
  });

  it("keeps manual editing enabled on every paginated procedure page", () => {
    const longDocument: SOPDocument = {
      schemaVersion: "1",
      id: "editable-long-procedure",
      title: "Editable Long Procedure",
      actors: [{ id: "staff", name: "Staff" }],
      steps: Array.from({ length: 6 }, (_, index) => {
        const number = index + 1;
        const id = `step-${number}`;

        if (number === 1) {
          return {
            id,
            type: "start" as const,
            name: `Step ${number}`,
            actorIds: ["staff"],
            next: "step-2",
          };
        }

        if (number === 6) {
          return {
            id,
            type: "end" as const,
            name: `Step ${number}`,
            actorIds: ["staff"],
          };
        }

        return {
          id,
          type: "task" as const,
          name: `Step ${number}`,
          actorIds: ["staff"],
          next: `step-${number + 1}`,
        };
      }),
    };

    const { container } = render(
      <SopProcedureView
        document={longDocument}
        manualEditing
        firstPageRows={2}
        nextPageRows={2}
      />,
    );

    expect(
      container.querySelectorAll(
        "[data-sopflow-procedure-page][data-manual-editing='true']",
      ),
    ).toHaveLength(3);
  });
  it("aligns cross-page OPC-out with Admin and OPC-in with Student outside the table", () => {
    const multiActorDocument: SOPDocument = {
      schemaVersion: "1",
      id: "admin-student",
      title: "Admin to Student",
      actors: [
        { id: "admin", name: "Admin" },
        { id: "student", name: "Student" },
      ],
      steps: [
        {
          id: "s1",
          type: "start",
          name: "Start",
          actorIds: ["admin"],
          next: "s2",
        },
        {
          id: "s2",
          type: "task",
          name: "Admin work",
          actorIds: ["admin"],
          next: "s3",
        },
        {
          id: "s3",
          type: "task",
          name: "Student work",
          actorIds: ["student"],
          next: "s4",
        },
        { id: "s4", type: "end", name: "End", actorIds: ["student"] },
      ],
    };
    const { container } = render(
      <SopProcedureView
        document={multiActorDocument}
        firstPageRows={2}
        nextPageRows={2}
      />,
    );
    const first = container.querySelector('[data-sopflow-procedure-page="0"]');
    const second = container.querySelector('[data-sopflow-procedure-page="1"]');
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();

    const outgoing = first?.querySelector(
      '[data-sopflow-opc-strip="bottom"] [data-sopflow-opc-actor-id="admin"][data-variant="out"]',
    );
    const incoming = second?.querySelector(
      '[data-sopflow-opc-strip="top"] [data-sopflow-opc-actor-id="student"][data-variant="in"]',
    );
    expect(outgoing).not.toBeNull();
    expect(incoming).not.toBeNull();
    expect(outgoing?.querySelector("text")?.textContent).toBe("A");
    expect(incoming?.querySelector("text")?.textContent).toBe("A");
    expect(first?.querySelector("table [data-sopflow-opc]")).toBeNull();
    expect(second?.querySelector("table [data-sopflow-opc]")).toBeNull();
    expect(first?.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(second?.querySelectorAll("tbody tr")).toHaveLength(2);
  });
});
