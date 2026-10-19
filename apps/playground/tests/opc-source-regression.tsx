import React from "react";
import { createRoot } from "react-dom/client";
import type { SOPDocument } from "@sopflow/core";

// Intentional CI-only entry: source under test, NOT the npm v0.1.0 consumer.
// The normal apps/playground/index.html still imports published @sopflow/*.
import { SopProcedureView } from "../../../packages/react/src/diagram/procedure/SopProcedureView.tsx";

const document: SOPDocument = {
  schemaVersion: "1",
  id: "opc-source-acceptance",
  title: "Actor-aware OPC source regression",
  actors: [
    { id: "admin", name: "Admin" },
    { id: "student", name: "Student" },
  ],
  steps: [
    { id: "s1", type: "start", name: "Mulai", actorIds: ["admin"], next: "s2" },
    { id: "s2", type: "task", name: "Admin menyetujui", actorIds: ["admin"], next: "s3" },
    { id: "s3", type: "task", name: "Student menerima", actorIds: ["student"], next: "s4" },
    { id: "s4", type: "end", name: "Selesai", actorIds: ["student"] },
  ],
};

const budgetDocument: SOPDocument = {
  ...document,
  id: "opc-height-acceptance",
  steps: [
    { id: "t1", type: "start", name: "Start", actorIds: ["admin"], next: "t2" },
    { id: "t2", type: "task", name: "Prepare", actorIds: ["admin"], next: "t3" },
    { id: "t3", type: "task", name: "Approve", actorIds: ["admin"], next: "t4" },
    { id: "t4", type: "task", name: "Receive", actorIds: ["student"], next: "t5" },
    { id: "t5", type: "task", name: "Review", actorIds: ["student"], next: "t6" },
    { id: "t6", type: "end", name: "Finish", actorIds: ["student"] },
  ],
};

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("OPC regression root missing");

createRoot(rootElement).render(
  <>
    <article id="actor-case">
      <h1>OPC actor alignment — source build</h1>
      <SopProcedureView document={document} firstPageRows={2} nextPageRows={2} />
    </article>
    <article id="budget-case">
      <h1>Height-aware page packing</h1>
      <SopProcedureView
        document={budgetDocument}
        pageHeightPx={540}
        firstPageReservedHeightPx={0}
        nextPageReservedHeightPx={0}
      />
    </article>
  </>,
);

function centerX(el: Element): number {
  const box = el.getBoundingClientRect();
  return (box.left + box.right) / 2;
}

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function verify() {
  const pages = [...document.querySelectorAll("#actor-case [data-sopflow-procedure-page]")];
  assert(pages.length === 2, `Actor scenario expected 2 pages, got ${pages.length}`);
  const [page0, page1] = pages;
  assert(page0 && page1, "Missing source or destination page");

  const out = page0.querySelector(
    '[data-sopflow-opc-strip="bottom"] [data-sopflow-opc-actor-id="admin"][data-variant="out"]',
  );
  const incoming = page1.querySelector(
    '[data-sopflow-opc-strip="top"] [data-sopflow-opc-actor-id="student"][data-variant="in"]',
  );
  assert(out && incoming, "Actor-specific external OPC endpoints not present");

  const admin = page0.querySelector('[data-sopflow-actor-header][data-sopflow-actor-id="admin"]');
  const student = page1.querySelector('[data-sopflow-actor-header][data-sopflow-actor-id="student"]');
  assert(admin && student, "Actor column headers not found");
  const firstOffset = Math.abs(centerX(out) - centerX(admin));
  const nextOffset = Math.abs(centerX(incoming) - centerX(student));
  assert(firstOffset <= 2 && nextOffset <= 2,
    `OPC actor center mismatch: Admin ${firstOffset}px, Student ${nextOffset}px`);
  assert(Math.abs(centerX(out) - centerX(incoming)) > 10,
    "Independent OPC actors were incorrectly given the same X coordinate");
  assert(out.querySelector("text")?.textContent === "A" &&
    incoming.querySelector("text")?.textContent === "A",
    "OPC pair labels differ");

  const allTables = [...document.querySelectorAll("#actor-case table")];
  assert(allTables.every((table) => table.querySelectorAll("[data-sopflow-opc]").length === 0),
    "OPC was inserted into the procedure table");
  const rows = document.querySelectorAll("#actor-case table tbody tr");
  assert(rows.length === 4, `Expected four procedure rows, got ${rows.length}`);

  const routeCount = pages.reduce(
    (sum, page) => sum + page.querySelectorAll('svg[class*="overlay"] path[class*="edge"]').length,
    0,
  );
  assert(routeCount >= 2, `SVG routing did not reach external OPC endpoints (edges: ${routeCount})`);

  const budgetPages = [...document.querySelectorAll("#budget-case [data-sopflow-procedure-page]")];
  assert(budgetPages.length >= 2, "Height-aware procedure did not paginate");
  const budgetRows = document.querySelectorAll("#budget-case table tbody tr");
  assert(budgetRows.length === 6, "Height-aware pagination lost procedure rows");
  for (const page of budgetPages) {
    const height = page.getBoundingClientRect().height;
    assert(height > 0 && height <= 542, `Procedure page physically exceeds 540px budget: ${height}px`);
    assert(page.querySelector("table [data-sopflow-opc]") === null, "OPC entered table on height-aware page");
  }
  return {
    pages: pages.length,
    budgetPages: budgetPages.length,
    firstOffset,
    nextOffset,
    routeCount,
    stepCount: rows.length,
  };
}

window.setTimeout(() => {
  const status = document.createElement("output");
  status.setAttribute("data-source-opc-regression", "pending");
  try {
    const result = verify();
    status.setAttribute("data-source-opc-regression", "pass");
    status.textContent = JSON.stringify(result);
  } catch (error) {
    status.setAttribute("data-source-opc-regression", "fail");
    status.textContent = error instanceof Error ? error.message : String(error);
  }
  document.body.append(status);
}, 1200);
