import { useEffect, useRef, useState } from "react";
import type { SOPDocument } from "@sopflow/core";
import {
  SopBpmn,
  SopProcedureView,
  type SopDiagramConfig,
} from "@sopflow/react";
import "@sopflow/react/styles.css";

const sharedTargetDocument: SOPDocument = {
  schemaVersion: "1",
  id: "browser-formal-regression",
  title: "Browser Formal Regression",
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
      next: "decision",
    },
    {
      id: "decision",
      type: "decision",
      name: "Dokumen valid?",
      actorIds: ["staff"],
      yes: "target",
      no: "target",
    },
    {
      id: "target",
      type: "task",
      name: "Proses hasil pemeriksaan",
      actorIds: ["manager"],
      next: "end",
    },
    {
      id: "end",
      type: "end",
      name: "Selesai",
      actorIds: ["manager"],
    },
  ],
};

const firstLongLabel =
  "Verifikasi dokumen pengajuan pembayaran dan kelengkapan administrasi secara menyeluruh";
const secondLongLabel =
  "Lakukan validasi lanjutan untuk seluruh lampiran dan bukti pendukung pembayaran";

const bpmnDocument: SOPDocument = {
  schemaVersion: "1",
  id: "browser-bpmn-regression",
  title: "Browser BPMN Regression",
  actors: [{ id: "staff", name: "Staff" }],
  steps: [
    {
      id: "start",
      type: "start",
      name: "Mulai",
      actorIds: ["staff"],
      next: "long-a",
    },
    {
      id: "long-a",
      type: "task",
      name: firstLongLabel,
      actorIds: ["staff"],
      next: "long-b",
    },
    {
      id: "long-b",
      type: "task",
      name: secondLongLabel,
      actorIds: ["staff"],
      next: "end",
    },
    {
      id: "end",
      type: "end",
      name: "Selesai",
      actorIds: ["staff"],
    },
  ],
};

const denseBpmnDocument: SOPDocument = {
  schemaVersion: "1",
  id: "browser-dense-bpmn-regression",
  title: "Dense BPMN Regression",
  actors: Array.from({ length: 8 }, (_, index) => ({
    id: `actor-${index + 1}`,
    name: `Actor ${index + 1}`,
  })),
  steps: [
    ...Array.from({ length: 8 }, (_, index) => ({
      id: `start-${String(index + 1).padStart(2, "0")}`,
      type: "start" as const,
      name: `Start ${index + 1}`,
      actorIds: [`actor-${index + 1}`],
      next: "target",
    })),
    {
      id: "target",
      type: "task" as const,
      name: "Converged dense target",
      actorIds: ["actor-1"],
      next: "end",
    },
    {
      id: "end",
      type: "end" as const,
      name: "Selesai",
      actorIds: ["actor-1"],
    },
  ],
};

const denseOpcDocument: SOPDocument = {
  schemaVersion: "1",
  id: "browser-dense-opc-regression",
  title: "Dense OPC Regression",
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
      next: "decision-01",
    },
    ...Array.from({ length: 28 }, (_, index) => {
      const number = index + 1;
      const id = `decision-${String(number).padStart(2, "0")}`;
      const next =
        number === 28
          ? "end"
          : `decision-${String(number + 1).padStart(2, "0")}`;

      return {
        id,
        type: "decision" as const,
        name: `Decision ${number}`,
        actorIds: [number % 2 === 0 ? "manager" : "staff"],
        yes: next,
        no: "end",
      };
    }),
    {
      id: "end",
      type: "end",
      name: "Selesai",
      actorIds: ["manager"],
    },
  ],
};

type RegressionStatus = "pending" | "pass" | "fail";

export function DiagramRegressionSmoke() {
  const rootRef = useRef<HTMLElement>(null);
  const [diagramConfig, setDiagramConfig] = useState<SopDiagramConfig>({});
  const [status, setStatus] = useState<RegressionStatus>("pending");
  const [failures, setFailures] = useState<readonly string[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const root = rootRef.current;
      if (!root) {
        setFailures(["regression root is missing"]);
        setStatus("fail");
        return;
      }

      const nextFailures: string[] = [];
      const formalRegression = root.querySelector<HTMLElement>(
        '[data-regression-section="formal-shared-target"]',
      );
      const pages =
        formalRegression?.querySelectorAll("[data-sopflow-procedure-page]") ??
        [];
      if (pages.length !== 2) {
        nextFailures.push(`expected 2 formal pages, received ${pages.length}`);
      }

      const opcIds = Array.from(
        formalRegression?.querySelectorAll<HTMLElement>("[data-sopflow-opc]") ??
          [],
      ).map((element) => element.dataset.sopflowOpc ?? "");
      if (opcIds.length !== 4 || new Set(opcIds).size !== opcIds.length) {
        nextFailures.push(
          `expected 4 unique OPC endpoints, received ${opcIds.join(",")}`,
        );
      }

      const editableRoutes = Array.from(
        formalRegression?.querySelectorAll<SVGGElement>(
          "[data-sopflow-editable-route]",
        ) ?? [],
      );
      if (editableRoutes.length < 6) {
        nextFailures.push(
          `expected at least 6 routed formal segments, received ${editableRoutes.length}`,
        );
      }
      for (const route of editableRoutes) {
        const d = route.querySelector("path")?.getAttribute("d") ?? "";
        if (!d || /NaN|Infinity/.test(d)) {
          nextFailures.push("formal route contains invalid SVG coordinates");
          break;
        }
      }

      const bpmn = root.querySelector<SVGElement>(
        '[data-regression-section="bpmn-labels"] [data-sopflow-bpmn] svg',
      );
      const firstNode = bpmn?.querySelector<SVGGElement>(
        '[data-sopflow-step-id="long-a"]',
      );
      const secondNode = bpmn?.querySelector<SVGGElement>(
        '[data-sopflow-step-id="long-b"]',
      );
      const firstLines = Array.from(firstNode?.querySelectorAll("tspan") ?? [])
        .map((line) => line.textContent ?? "")
        .join(" ");
      const secondLines = Array.from(
        secondNode?.querySelectorAll("tspan") ?? [],
      )
        .map((line) => line.textContent ?? "")
        .join(" ");

      if (firstLines !== firstLongLabel || secondLines !== secondLongLabel) {
        nextFailures.push("BPMN multiline labels do not preserve full content");
      }

      if (!firstNode || !secondNode) {
        nextFailures.push("BPMN long-label nodes are missing");
      } else {
        const firstBox = firstNode.getBBox();
        const secondBox = secondNode.getBBox();
        const finiteBoxes = [firstBox, secondBox].every((box) =>
          [box.x, box.y, box.width, box.height].every(Number.isFinite),
        );
        if (!finiteBoxes) {
          nextFailures.push("BPMN node bounds contain invalid coordinates");
        }
        if (firstBox.x + firstBox.width >= secondBox.x) {
          nextFailures.push("adjacent BPMN node footprints overlap");
        }
      }

      const bpmnPaths = Array.from(bpmn?.querySelectorAll("path") ?? []);
      if (
        bpmnPaths.some((path) =>
          /NaN|Infinity/.test(path.getAttribute("d") ?? ""),
        )
      ) {
        nextFailures.push("BPMN path contains invalid SVG coordinates");
      }

      const denseBpmn = root.querySelector<SVGElement>(
        '[data-regression-section="bpmn-dense"] [data-sopflow-bpmn] svg',
      );
      const densePaths = Array.from(denseBpmn?.querySelectorAll("path") ?? []);
      if (densePaths.length < 9) {
        nextFailures.push(
          `expected dense BPMN routes, received ${densePaths.length} paths`,
        );
      }
      if (
        densePaths.some((path) =>
          /NaN|Infinity/.test(path.getAttribute("d") ?? ""),
        )
      ) {
        nextFailures.push("dense BPMN path contains invalid coordinates");
      }

      const denseTarget = denseBpmn?.querySelector<SVGGElement>(
        '[data-sopflow-step-id="target"]',
      );
      if (!denseTarget) {
        nextFailures.push("dense BPMN fan-in target is missing");
      } else {
        const box = denseTarget.getBBox();
        if (![box.x, box.y, box.width, box.height].every(Number.isFinite)) {
          nextFailures.push("dense BPMN target has invalid geometry");
        }
      }

      const denseOpc = root.querySelector<HTMLElement>(
        '[data-regression-section="formal-dense-opc"]',
      );
      const opcLabels = Array.from(
        denseOpc?.querySelectorAll<HTMLElement>("[data-sopflow-opc]") ?? [],
      ).map((element) => element.getAttribute("aria-label") ?? "");
      if (!opcLabels.some((label) => label.endsWith("AA"))) {
        nextFailures.push("dense OPC sequence never reached AA");
      }
      if (!opcLabels.some((label) => label.endsWith("AB"))) {
        nextFailures.push("dense OPC sequence never reached AB");
      }

      setFailures(nextFailures);
      setStatus(nextFailures.length === 0 ? "pass" : "fail");
    }, 600);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main
      ref={rootRef}
      data-diagram-regression={status}
      style={{ width: 1120, margin: "0 auto", padding: 24 }}
    >
      <output data-diagram-regression-output>
        {status === "pending"
          ? "pending"
          : failures.length === 0
            ? "pass"
            : failures.join(" | ")}
      </output>

      <section
        aria-label="Formal browser regression"
        data-regression-section="formal-shared-target"
      >
        <SopProcedureView
          document={sharedTargetDocument}
          manualEditing
          diagramConfig={diagramConfig}
          onDiagramConfigChange={setDiagramConfig}
          firstPageRows={2}
          nextPageRows={2}
        />
      </section>

      <section
        aria-label="BPMN browser regression"
        data-regression-section="bpmn-labels"
      >
        <SopBpmn document={bpmnDocument} />
      </section>

      <section
        aria-label="Dense BPMN browser regression"
        data-regression-section="bpmn-dense"
      >
        <SopBpmn document={denseBpmnDocument} />
      </section>

      <section
        aria-label="Dense OPC browser regression"
        data-regression-section="formal-dense-opc"
      >
        <SopProcedureView
          document={denseOpcDocument}
          firstPageRows={29}
          nextPageRows={1}
        />
      </section>
    </main>
  );
}
