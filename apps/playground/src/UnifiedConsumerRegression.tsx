import { useEffect } from "react";
import { ReactPackageSmoke } from "./ReactPackageSmoke.js";

function button(root: ParentNode, label: string): HTMLButtonElement {
  const result = Array.from(root.querySelectorAll("button")).find(
    (item) =>
      item.getAttribute("aria-label") === label ||
      item.textContent?.trim() === label ||
      (label === "Problems" && item.textContent?.trim().startsWith(label)),
  );
  if (!result) throw new Error("Missing button: " + label);
  return result;
}

function requireState(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function tick(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 120));
}

async function exercise(): Promise<void> {
  await tick();
  const root = document.querySelector<HTMLElement>(
    "[data-sopflow-unified-workspace]",
  );
  requireState(root, "Published unified workspace did not mount");
  requireState(
    root.querySelectorAll('[data-sopflow-page="a4"]').length === 1,
    "The A4 document must appear exactly once",
  );
  requireState(
    !root.querySelector("[data-sopflow-document-toolbar]"),
    "The legacy in-document toolbar is still present",
  );
  requireState(root.querySelector("[data-sopflow-problems]"), "Missing Problems");
  requireState(
    !root.querySelector("[data-sopflow-validation-panel]"),
    "The old validation panel duplicates Problems",
  );

  button(root, "BPMN").click();
  await tick();
  requireState(root.querySelector("[data-sopflow-bpmn]"), "BPMN mode failed");

  button(root, "Steps").click();
  await tick();
  requireState(
    root.querySelector("[data-sopflow-steps-scroll]"),
    "Steps mode failed",
  );
  button(root, "Flowchart").click();
  await tick();
  requireState(
    root.querySelector("[data-sopflow-procedure-view]"),
    "Flowchart mode failed",
  );

  button(root, "Edit routes").click();
  await tick();
  requireState(
    root.querySelector(
      '[data-sopflow-procedure-view][data-manual-editing="true"]',
    ),
    "Manual route editing is disconnected",
  );
  button(root, "Edit routes").click();
  await tick();

  const inspectorToggle = button(root, "Toggle Properties");
  inspectorToggle.click();
  await tick();
  requireState(
    !root.querySelector("[data-sopflow-inspector]"),
    "The inspector did not close",
  );
  inspectorToggle.click();
  await tick();
  requireState(
    root.querySelector("[data-sopflow-inspector]"),
    "The inspector did not reopen",
  );

  const canvas = root.querySelector<HTMLElement>("[data-sopflow-canvas-stage]");
  requireState(canvas, "Missing zoomable canvas");
  button(root, "Zoom in").click();
  await tick();
  requireState(
    root.getAttribute("data-zoom-mode") === "manual",
    "Zoom did not enter manual mode",
  );
  requireState(
    Number.isFinite(Number(canvas.getAttribute("data-preview-scale"))),
    "Zoom scale is not finite",
  );
  button(root, "Fit to viewport").click();
  await tick();
  requireState(
    root.getAttribute("data-zoom-mode") === "fit",
    "Fit did not restore responsive mode",
  );

  button(root, "Problems").click();
  await tick();
  const problemIssue = Array.from(
    root.querySelectorAll<HTMLButtonElement>(
      "[data-sopflow-problems] button",
    ),
  ).find((item) => item.textContent?.includes("Dasar hukum harus diisi"));
  requireState(problemIssue, "The readiness issue was not reported");
  problemIssue.click();
  await tick();
  requireState(
    (document.activeElement as HTMLElement | null)?.getAttribute(
      "data-sopflow-header-field",
    ) === "lawBasis",
    "Issue navigation did not focus the correction field",
  );

  const stage = root.querySelector<HTMLElement>("[data-sopflow-unified-stage]");
  requireState(stage, "Missing responsive workspace stage");
  const compact = stage.clientWidth <= 620;
  requireState(
    root.hasAttribute("data-compact") === compact,
    "Compact inspector state is incorrect",
  );
  requireState(
    Boolean(root.querySelector("[data-sopflow-inspector-resize]")) === !compact,
    "Inspector resize handle is incorrect for viewport",
  );
  const paper = root.querySelector<HTMLElement>('[data-sopflow-page="a4"]');
  requireState(paper, "A4 document disappeared");
  const physicalWidth = Number.parseFloat(getComputedStyle(paper).width);
  requireState(
    physicalWidth > 1100 && physicalWidth < 1140,
    "Physical A4 page width was changed by zoom",
  );
}

export function UnifiedConsumerRegression() {
  useEffect(() => {
    const output = document.getElementById("unified-consumer-regression-status");
    if (!output) return;
    void exercise()
      .then(() => {
        output.setAttribute("data-unified-consumer-regression", "pass");
        output.textContent = "Unified npm consumer passed";
      })
      .catch((cause: unknown) => {
        output.setAttribute("data-unified-consumer-regression", "fail");
        output.textContent =
          cause instanceof Error ? cause.message : String(cause);
      });
  }, []);

  return (
    <main className="h-[100dvh] overflow-hidden bg-surface">
      <ReactPackageSmoke />
      <output
        id="unified-consumer-regression-status"
        data-unified-consumer-regression="pending"
        className="sr-only"
        aria-live="polite"
      >
        Running unified consumer smoke
      </output>
    </main>
  );
}
