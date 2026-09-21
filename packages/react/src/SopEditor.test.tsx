import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { validateSop, type SOPDocument } from "@sopflow/core";

import { SopEditor } from "./SopEditor.js";
import type { SopHeaderValue } from "./types.js";

const initialDocument: SOPDocument = {
  schemaVersion: "1",
  id: "sop",
  title: "Test SOP",
  actors: [],
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
      name: "Review",
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

const initialHeader: SopHeaderValue = {
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

const decisionDocument: SOPDocument = {
  schemaVersion: "1",
  id: "decision-sop",
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
      name: "Proses approval",
      actorIds: [],
      next: "end",
    },
    {
      id: "reject",
      type: "task",
      name: "Perbaiki",
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

const sharedDecisionDocument: SOPDocument = {
  schemaVersion: "1",
  id: "shared-decision-sop",
  title: "Shared Decision SOP",
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
      name: "Perlu review?",
      actorIds: [],
      yes: "shared",
      no: "shared",
    },
    {
      id: "shared",
      type: "task",
      name: "Shared",
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

const actorDocument: SOPDocument = {
  schemaVersion: "1",
  id: "actor-sop",
  title: "Actor SOP",
  actors: [
    {
      id: "manager",
      name: "Manager",
    },
    {
      id: "staff",
      name: "Staff",
    },
  ],
  steps: [
    {
      id: "start",
      type: "start",
      name: "Mulai",
      actorIds: [],
      next: "review",
    },
    {
      id: "review",
      type: "task",
      name: "Review dokumen",
      actorIds: ["manager", "staff"],
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

function ControlledEditor() {
  const [document, setDocument] = useState(initialDocument);
  const [header, setHeader] = useState(initialHeader);

  return (
    <SopEditor
      value={document}
      onChange={setDocument}
      header={header}
      onHeaderChange={setHeader}
    />
  );
}

function EditorHarness({
  initial = initialDocument,
}: {
  initial?: SOPDocument;
}) {
  const [document, setDocument] = useState(initial);
  const [header, setHeader] = useState(initialHeader);

  return (
    <>
      <SopEditor
        value={document}
        onChange={setDocument}
        header={header}
        onHeaderChange={setHeader}
      />
      <output data-testid="document">{JSON.stringify(document)}</output>
    </>
  );
}

function enterStepEditing() {
  const button = screen.queryByRole("button", { name: "Langkah" });
  if (button) {
    fireEvent.click(button);
  }
}

function getDesktopStepRow(stepId: string) {
  enterStepEditing();

  const row = globalThis.document.querySelector<HTMLElement>(
    `tr[data-sopflow-step-id="${stepId}"]`,
  );

  if (!row) {
    throw new Error(`Desktop step row not found: ${stepId}`);
  }

  return row;
}

function getReviewField() {
  return within(getDesktopStepRow("task")).getByLabelText("Kegiatan");
}

function getField(value: string) {
  enterStepEditing();

  const row = Array.from(
    globalThis.document.querySelectorAll<HTMLElement>(
      "tr[data-sopflow-step-id]",
    ),
  ).find((candidate) => candidate.textContent?.includes(value));

  if (!row) {
    throw new Error(`Desktop step row not found: ${value}`);
  }

  return within(row).getByLabelText("Kegiatan");
}

function getStepRow(field: HTMLElement) {
  const row = field.closest("[data-sopflow-step-id]");

  if (!row) {
    throw new Error("Step row not found");
  }

  return row as HTMLElement;
}

function readDocument(): SOPDocument {
  return JSON.parse(
    screen.getByTestId("document").textContent ?? "{}",
  ) as SOPDocument;
}

describe("SopEditor document workbench", () => {
  it("renders diagram controls without undo or redo", () => {
    render(<ControlledEditor />);

    expect(screen.getByRole("button", { name: "Langkah" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit Manual" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Flowchart" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "BPMN" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /undo/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /redo/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps controlled diagram config read-only without a change handler", () => {
    render(
      <SopEditor
        value={initialDocument}
        onChange={() => {}}
        header={initialHeader}
        diagramConfig={{}}
      />,
    );

    expect(screen.getByRole("button", { name: "Edit Manual" })).toBeDisabled();
  });

  it("allows manual route editing when controlled config has a change handler", () => {
    render(
      <SopEditor
        value={initialDocument}
        onChange={() => {}}
        header={initialHeader}
        diagramConfig={{}}
        onDiagramConfigChange={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: "Edit Manual" })).toBeEnabled();
  });

  it("edits steps inline in the document instead of the inspector", async () => {
    const user = userEvent.setup();
    const { container } = render(<ControlledEditor />);

    await user.click(screen.getByRole("button", { name: "Langkah" }));

    expect(screen.getByRole("button", { name: "Diagram" })).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("Review")[0]).toBeInTheDocument();
    expect(
      screen.getByRole("region", {
        name: /editor langkah sop; gulir horizontal/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/geser tabel secara horizontal/i),
    ).toBeInTheDocument();

    const inspector = container.querySelector("[data-sopflow-inspector]");
    expect(inspector).not.toBeNull();
    expect(
      within(inspector as HTMLElement).queryByLabelText("Kegiatan"),
    ).not.toBeInTheDocument();
  });

  it("keeps read-only mode free of editing controls", () => {
    render(
      <SopEditor value={initialDocument} header={initialHeader} readOnly />,
    );

    expect(
      screen.queryByRole("button", { name: "Langkah" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit Manual" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /tambah pelaksana/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Flowchart" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "BPMN" })).toBeInTheDocument();
  });
});

describe("SopEditor graph mutations", () => {
  it("creates the initial workflow from the empty state", async () => {
    const user = userEvent.setup();
    const emptyDocument: SOPDocument = {
      ...initialDocument,
      steps: [],
    };

    render(<EditorHarness initial={emptyDocument} />);

    await user.click(screen.getByRole("button", { name: "Langkah" }));
    await user.click(
      screen.getByRole("button", { name: /buat langkah awal/i }),
    );

    const document = readDocument();

    expect(document.steps.map((step) => step.type)).toEqual([
      "start",
      "task",
      "end",
    ]);

    expect(document.steps[0]).toMatchObject({
      type: "start",
      next: document.steps[1]?.id,
    });
    expect(document.steps[1]).toMatchObject({
      type: "task",
      next: document.steps[2]?.id,
    });
  });

  it("inserts a step after the selected task and rewires next", async () => {
    const user = userEvent.setup();

    render(<EditorHarness />);

    const row = getStepRow(getReviewField());

    await user.click(getReviewField());
    await user.click(within(row).getByRole("button", { name: /aksi untuk/i }));
    await user.click(
      within(row).getByRole("button", {
        name: /tambah langkah setelah/i,
      }),
    );

    const document = readDocument();
    const task = document.steps.find((step) => step.id === "task");

    expect(task?.type).toBe("task");

    if (task?.type !== "task") {
      throw new Error("task not found");
    }

    const inserted = document.steps.find((step) => step.id === task.next);

    expect(inserted).toBeDefined();
    expect(inserted?.type).toBe("task");

    if (inserted?.type !== "task") {
      throw new Error("inserted task not found");
    }

    expect(inserted.next).toBe("end");
  });

  it("shows decision branch targets inline using authoring order", () => {
    render(<EditorHarness initial={decisionDocument} />);

    const row = getDesktopStepRow("decision");

    expect(within(row).getByText("Ya → 3 · Tidak → 4")).toBeInTheDocument();
  });

  it("updates decision branches through the decision editor", async () => {
    const user = userEvent.setup();

    render(<EditorHarness initial={decisionDocument} />);

    const row = getStepRow(getField("Disetujui?"));

    await user.click(within(row).getByRole("button", { name: /aksi untuk/i }));
    await user.click(within(row).getByRole("button", { name: /atur cabang/i }));

    await user.selectOptions(screen.getByLabelText(/tidak/i), "end");
    await user.click(screen.getByRole("button", { name: /simpan/i }));

    const document = readDocument();
    const decision = document.steps.find((step) => step.id === "decision");

    expect(decision?.type).toBe("decision");

    if (decision?.type !== "decision") {
      throw new Error("decision not found");
    }

    expect(decision.yes).toBe("approve");
    expect(decision.no).toBe("end");
  });

  it("rewires incoming connections when deleting a step", async () => {
    const user = userEvent.setup();

    render(<EditorHarness />);

    const row = getStepRow(getReviewField());

    await user.click(within(row).getByRole("button", { name: /aksi untuk/i }));
    await user.click(
      within(row).getByRole("button", { name: /hapus langkah/i }),
    );
    await user.selectOptions(
      screen.getByLabelText(/sambungkan langkah sebelumnya/i),
      "end",
    );
    await user.click(screen.getByRole("button", { name: /^hapus$/i }));

    const document = readDocument();
    const start = document.steps.find((step) => step.id === "start");

    expect(document.steps.some((step) => step.id === "task")).toBe(false);
    expect(start?.type).toBe("start");

    if (start?.type !== "start") {
      throw new Error("start not found");
    }

    expect(start.next).toBe("end");
  });

  it("rewires multiple incoming decision branches when deleting a shared step", async () => {
    const user = userEvent.setup();

    render(<EditorHarness initial={sharedDecisionDocument} />);

    const row = getStepRow(getField("Shared"));

    await user.click(within(row).getByRole("button", { name: /aksi untuk/i }));
    await user.click(
      within(row).getByRole("button", { name: /hapus langkah/i }),
    );
    await user.selectOptions(
      screen.getByLabelText(/sambungkan langkah sebelumnya/i),
      "end",
    );
    await user.click(screen.getByRole("button", { name: /^hapus$/i }));

    const document = readDocument();
    const decision = document.steps.find((step) => step.id === "decision");

    expect(document.steps.some((step) => step.id === "shared")).toBe(false);
    expect(decision?.type).toBe("decision");

    if (decision?.type !== "decision") {
      throw new Error("decision not found");
    }

    expect(decision.yes).toBe("end");
    expect(decision.no).toBe("end");
  });
});

describe("SopEditor actor mutations", () => {
  it("adds an actor", async () => {
    const user = userEvent.setup();

    render(<EditorHarness initial={actorDocument} />);

    await user.click(screen.getByRole("button", { name: /tambah pelaksana/i }));

    const document = readDocument();

    expect(document.actors).toHaveLength(3);
    expect(document.actors[2]?.name).toBe("");
  });

  it("updates an actor name", async () => {
    const user = userEvent.setup();

    render(<EditorHarness initial={actorDocument} />);

    const managerInput = screen.getByRole("textbox", {
      name: "Nama pelaksana 1",
    });

    await user.clear(managerInput);
    await user.type(managerInput, "Supervisor");

    const document = readDocument();

    expect(document.actors.find((actor) => actor.id === "manager")?.name).toBe(
      "Supervisor",
    );
  });

  it("removes one actor assignment without dropping the others", async () => {
    const user = userEvent.setup();

    render(<EditorHarness initial={actorDocument} />);

    const row = getStepRow(getField("Review dokumen"));
    const actorTrigger = row.querySelector<HTMLElement>(
      "[data-sopflow-actor-trigger]",
    );

    expect(actorTrigger).not.toBeNull();

    await user.click(actorTrigger as HTMLElement);
    await user.click(within(row).getByRole("checkbox", { name: "Manager" }));

    const document = readDocument();
    const review = document.steps.find((step) => step.id === "review");

    expect(review?.actorIds).toEqual(["staff"]);
  });

  it("removes actor references from steps without exposing undo", async () => {
    const user = userEvent.setup();

    render(<EditorHarness initial={actorDocument} />);

    const managerInput = screen.getByRole("textbox", {
      name: "Nama pelaksana 1",
    });
    const actorRow = managerInput.closest("[data-sopflow-actor-id]");

    expect(actorRow).not.toBeNull();

    await user.click(
      within(actorRow as HTMLElement).getByRole("button", {
        name: /hapus/i,
      }),
    );

    expect(screen.getByText(/digunakan oleh 1 langkah/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^hapus$/i }));

    const document = readDocument();

    expect(document.actors.some((actor) => actor.id === "manager")).toBe(false);

    const review = document.steps.find((step) => step.id === "review");

    expect(review?.actorIds).toEqual(["staff"]);
    expect(
      validateSop(document).some(
        (issue) => issue.code === "UNKNOWN_ACTOR_REFERENCE",
      ),
    ).toBe(false);
    expect(
      screen.queryByRole("button", { name: /undo/i }),
    ).not.toBeInTheDocument();
  });
});

describe("SopEditor dialog accessibility", () => {
  it("moves focus into the delete dialog and restores it after closing", async () => {
    const user = userEvent.setup();

    render(<EditorHarness />);

    const row = getStepRow(getReviewField());
    await user.click(within(row).getByRole("button", { name: /aksi untuk/i }));

    const deleteTrigger = within(row).getByRole("button", {
      name: /hapus langkah/i,
    });

    await user.click(deleteTrigger);

    const dialog = await screen.findByRole("alertdialog");

    await waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true);
    });

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(deleteTrigger);
  });

  it("keeps tab focus inside a dialog", async () => {
    const user = userEvent.setup();
    const getClientRects = vi
      .spyOn(HTMLElement.prototype, "getClientRects")
      .mockReturnValue({ length: 1 } as DOMRectList);

    try {
      render(<EditorHarness />);

      const row = getStepRow(getReviewField());
      await user.click(
        within(row).getByRole("button", { name: /aksi untuk/i }),
      );
      await user.click(
        within(row).getByRole("button", { name: /hapus langkah/i }),
      );

      const dialog = await screen.findByRole("alertdialog");
      const select = within(dialog).getByRole("combobox");
      const cancelButton = within(dialog).getByRole("button", {
        name: "Batal",
      });

      await waitFor(() => {
        expect(document.activeElement).toBe(select);
      });

      await user.keyboard("{Shift>}{Tab}{/Shift}");
      expect(document.activeElement).toBe(cancelButton);

      await user.tab();
      expect(document.activeElement).toBe(select);
      expect(dialog.contains(document.activeElement)).toBe(true);
    } finally {
      getClientRects.mockRestore();
    }
  });
});
