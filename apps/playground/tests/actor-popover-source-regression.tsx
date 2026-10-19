import { useState } from "react";
import { createRoot } from "react-dom/client";
import type { Actor } from "@sopflow/core";
import "../../../packages/react/src/styles/uiarc-scoped.css";
import "../../../packages/react/src/styles/token.css";
import { ActorField } from "../../../packages/react/src/steps/fields/ActorField.tsx";

const actors: Actor[] = [
  { id: "staff", name: "Staff" },
  { id: "manager", name: "Manager" },
  { id: "supervisor", name: "Supervisor" },
  { id: "admin", name: "Admin" },
  { id: "student", name: "Student" },
];

function Scenario() {
  const [value, setValue] = useState(["manager"]);
  return (
    <div data-sopflow-root>
      <h1>Pelaksana popup inside horizontally scrollable steps table</h1>
      <section
        data-sopflow-steps-scroll
        style={{ width: 440, height: 145, overflow: "auto", border: "1px solid #ddd" }}
      >
        <table style={{ width: 930, borderCollapse: "collapse" }}>
          <tbody>
            <tr style={{ height: 60 }}>
              <td>3</td>
              <td>Dokumen valid?</td>
              <td>Decision</td>
              <td>Manager</td>
            </tr>
            <tr style={{ height: 58 }}>
              <td>4</td>
              <td>Selesai</td>
              <td style={{ width: 180 }}>Selesai</td>
              <td style={{ width: 200 }}>
                <ActorField value={value} actors={actors} onChange={setValue} />
              </td>
              <td>Kelengkapan</td>
            </tr>
          </tbody>
        </table>
      </section>
      <output data-actor-state>{value.join(",")}</output>
    </div>
  );
}

const node = document.getElementById("root");
if (!node) throw new Error("Actor popover test root missing");
createRoot(node).render(<Scenario />);

function assert(value: unknown, detail: string): asserts value {
  if (!value) throw new Error(detail);
}

function result(status: "pass" | "fail", detail: string) {
  const node = document.createElement("output");
  node.setAttribute("data-actor-popover-regression", status);
  node.textContent = detail;
  document.body.appendChild(node);
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function run() {
  await delay(250);
  const scrollport = document.querySelector<HTMLElement>("[data-sopflow-steps-scroll]");
  const trigger = document.querySelector<HTMLButtonElement>(
    "[data-sopflow-actor-trigger]",
  );
  assert(scrollport && trigger, "Missing table viewport or actor trigger");
  trigger.click();
  await delay(650);

  const menu = document.querySelector<HTMLElement>('[role="listbox"][aria-label="Pelaksana"]');
  assert(menu, "Actor menu did not open");
  assert(menu.parentElement === document.body, "Actor menu was not portaled to body");
  assert(!scrollport.contains(menu), "Actor menu is still clipped inside table viewport");
  const before = menu.getBoundingClientRect();
  assert(before.top >= 0 && before.bottom <= window.innerHeight + 3, "Actor menu overflows screen vertically");
  assert(before.left >= 0 && before.right <= window.innerWidth + 3, "Actor menu overflows screen horizontally");
  assert(menu.dataset.side === "top", "Bottom row menu should flip above in narrow viewport");

  scrollport.scrollLeft = 115;
  scrollport.dispatchEvent(new Event("scroll"));
  await delay(450);
  const after = menu.getBoundingClientRect();
  const anchor = trigger.getBoundingClientRect();
  const desired = Math.max(8, Math.min(anchor.left, window.innerWidth - 8 - after.width));
  assert(Math.abs(after.left - desired) <= 3, "Actor popover stopped tracking horizontal scroll");

  const option = Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="option"]')).find(
    (node) => node.textContent?.includes("Staff"),
  );
  assert(option, "Option Staff missing");
  option.click();
  await delay(350);
  assert(document.querySelector("[data-actor-state]")?.textContent === "staff,manager", "Portaled multi-selection lost state");
  assert(menu.isConnected, "Selecting one actor closed multi-select prematurely");

  trigger.focus();
  trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await delay(250);
  assert(!document.querySelector('[role="listbox"]'), "Escape did not dismiss actor popup");
  assert(document.activeElement === trigger, "Escape did not preserve actor trigger focus");

  result(
    "pass",
    JSON.stringify({
      initialSide: "top",
      menuParent: "body",
      before: { top: before.top, bottom: before.bottom },
      afterX: after.left,
      anchorX: anchor.left,
      selected: "staff,manager",
    }),
  );
}
run().catch((error: unknown) => {
  result("fail", error instanceof Error ? error.message : String(error));
});
