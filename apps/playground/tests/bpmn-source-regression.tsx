import { createRoot } from "react-dom/client";
import type { SOPDocument } from "@sopflow/core";
import { buildBpmnModel } from "@sopflow/diagram";
import { SopBpmn } from "../../../packages/react/src/diagram/SopBpmn.tsx";

const sopDocument: SOPDocument = {
  schemaVersion: "1",
  id: "compact-bpmn-acceptance",
  title: "Compact BPMN",
  actors: [
    { id: "staff", name: "Customer Support Representative" },
    { id: "manager", name: "Manager" },
    { id: "admin", name: "Admin" },
  ],
  steps: [
    { id: "start", type: "start", name: "Mulai", actorIds: ["staff"], next: "task" },
    { id: "task", type: "task", name: "Menerima permohonan", actorIds: ["staff"], next: "decision" },
    { id: "decision", type: "decision", name: "Dokumen valid?", actorIds: ["manager"], yes: "approve", no: "repair" },
    { id: "repair", type: "task", name: "Memperbaiki dokumen pengajuan", actorIds: ["staff"], next: "decision" },
    { id: "approve", type: "task", name: "Menyetujui", actorIds: ["admin"], next: "end" },
    { id: "end", type: "end", name: "Selesai", actorIds: ["admin"] },
  ],
};

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Compact BPMN test root missing");
const stage = document.createElement("div");
stage.id = "bpmn-stage";
rootElement.appendChild(stage);
createRoot(stage).render(<SopBpmn document={sopDocument} />);

function check(value: unknown, description: string): asserts value {
  if (!value) throw new Error(description);
}

function center(rect: DOMRect, axis: "x" | "y"): number {
  return axis === "x" ? (rect.left + rect.right) / 2 : (rect.top + rect.bottom) / 2;
}

function verify() {
  const model = buildBpmnModel(sopDocument);
  const svg = stage.querySelector<SVGSVGElement>("svg[role=img]");
  check(svg, "BPMN source SVG is absent");
  check(svg.getAttribute("width") === String(model.width), "SVG width is not intrinsic model width");
  check(svg.getAttribute("height") === String(model.height), "SVG height is not intrinsic model height");
  check(model.headerWidth === 36 && model.padding === 8, "Compact pool metrics are not active");
  const actorHeaders = [...svg.querySelectorAll<SVGRectElement>("rect")].filter(
    (rect) => Number(rect.getAttribute("width")) === model.headerWidth,
  );
  const labels = [...svg.querySelectorAll<SVGTextElement>("[data-sopflow-actor-lane-label]")];
  check(actorHeaders.length === model.lanes.length, "Missing actor lane header geometry");
  check(labels.length === model.lanes.length, "Missing vertical actor labels");
  for (const [index, label] of labels.entries()) {
    const lane = model.lanes[index];
    const header = actorHeaders[index];
    check(lane && header, "Actor lane/header mismatch");
    check(label.getAttribute("transform")?.startsWith("rotate(-90 "), "Actor label not rotated vertically");
    const labelRect = label.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();
    check(Math.abs(center(labelRect, "x") - center(headerRect, "x")) <= 3, "Actor label not centered horizontally");
    check(Math.abs(center(labelRect, "y") - center(headerRect, "y")) <= 3, "Actor label not centered vertically");
    check(labelRect.height <= headerRect.height + 2, "Long actor name escapes its lane");
  }
  const shapeCount = svg.querySelectorAll("[data-sopflow-step-id]").length;
  check(shapeCount === sopDocument.steps.length, "BPMN lost one or more shapes");
  const routeCount = model.edges.length;
  check(routeCount >= 5, "BPMN routing lost semantic connections");
  check(model.edges.every((edge) => edge.points.length >= 2), "BPMN contains empty routes");
  const unscaled = svg.getBoundingClientRect();
  check(unscaled.width <= model.width + 2, "Small pool was inflated to viewport width");
  check(unscaled.height <= model.height + 2, "Small pool was inflated to minimum height");
  const root = stage.querySelector<HTMLElement>("[data-sopflow-bpmn]");
  check(root, "BPMN scroll viewport missing");
  root.style.width = "320px";
  const resized = svg.getBoundingClientRect();
  check(resized.width <= 322, "Narrow responsive preview extends outside its viewport");
  check(
    Math.abs(resized.width / resized.height - model.width / model.height) < 0.02,
    "Responsive SVG changed its shape aspect ratio",
  );
  root.style.width = "";
  return {
    lanes: model.lanes.length,
    steps: shapeCount,
    edges: routeCount,
    intrinsic: [model.width, model.height],
    compactHeader: model.headerWidth,
    narrowWidth: resized.width,
    actorLabel: "vertical",
  };
}

setTimeout(() => {
  const output = document.createElement("output");
  try {
    const result = verify();
    output.setAttribute("data-bpmn-source-regression", "pass");
    output.textContent = JSON.stringify(result);
  } catch (error) {
    output.setAttribute("data-bpmn-source-regression", "fail");
    output.textContent = error instanceof Error ? error.message : String(error);
  }
  document.body.appendChild(output);
}, 1200);
