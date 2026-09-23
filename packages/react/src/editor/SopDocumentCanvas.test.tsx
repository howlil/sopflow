import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SOPDocument } from "@sopflow/core";
import { SopDocumentCanvas } from "./SopDocumentCanvas.js";
import type { SopHeaderValue } from "../header/types.js";

const document: SOPDocument = {
  schemaVersion: "1",
  id: "a4-budget",
  title: "A4 budget",
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

function rect(top: number, height: number): DOMRect {
  return {
    x: 0,
    y: top,
    top,
    left: 0,
    right: 1120,
    bottom: top + height,
    width: 1120,
    height,
    toJSON() {
      return {};
    },
  } as DOMRect;
}

describe("SopDocumentCanvas A4 procedure budget", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the measured remaining A4 space for formal pagination", async () => {
    const originalGetComputedStyle = window.getComputedStyle.bind(window);

    vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
      if (
        element instanceof HTMLElement &&
        element.dataset.sopflowPage === "a4"
      ) {
        return {
          minHeight: "800px",
          paddingTop: "50px",
          paddingBottom: "50px",
        } as CSSStyleDeclaration;
      }

      return originalGetComputedStyle(element);
    });

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        if (this.dataset.sopflowPage === "a4") return rect(0, 800);
        if (this.dataset.sopflowDiagramPanel !== undefined) {
          return rect(300, 400);
        }
        return rect(0, 0);
      },
    );

    const { container } = render(
      <SopDocumentCanvas
        document={document}
        header={header}
        issues={[]}
        selectedStepId={null}
        onSelectedStepChange={() => {}}
        onOperation={() => {}}
        onOperations={() => {}}
        mode="preview"
        onModeChange={() => {}}
        diagramKind="flowchart"
        onDiagramKindChange={() => {}}
        manualEditing={false}
        onManualEditingChange={() => {}}
        diagramConfig={{}}
        onDiagramConfigChange={() => {}}
      />,
    );

    await waitFor(() => {
      expect(
        container.querySelector("[data-sopflow-procedure-pages='2']"),
      ).not.toBeNull();
    });
  });
});
