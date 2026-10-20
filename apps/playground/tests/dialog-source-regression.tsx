import { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../../packages/react/src/styles/uiarc-scoped.css";
import "../../../packages/react/src/styles/token.css";
import { Dialog } from "../../../packages/react/src/primitives/Dialog.tsx";
import { Select } from "../../../packages/react/src/components/arc/select/select.tsx";
import { SopDatePicker } from "../../../packages/react/src/components/sop-date-picker/SopDatePicker.tsx";
import { DeleteStepDialog } from "../../../packages/react/src/steps/DeleteStepDialog.tsx";
import { DeleteActorDialog } from "../../../packages/react/src/actors/DeleteActorDialog.tsx";
import { DecisionEditor } from "../../../packages/react/src/steps/DecisionEditor.tsx";
import type { SOPDocument, TaskStep, DecisionStep } from "@sopflow/core";

const documentFixture: SOPDocument = {
  schemaVersion: "1",
  id: "browser-modal-fixture",
  title: "Modal regression",
  actors: [{ id: "staff", name: "Staff" }],
  steps: [
    { id: "start", type: "start", name: "Mulai", actorIds: ["staff"], next: "task" },
    { id: "task", type: "task", name: "Tinjau", actorIds: ["staff"], next: "decision" },
    {
      id: "decision", type: "decision", name: "Valid?",
      actorIds: ["staff"], yes: "end", no: "task",
    },
    { id: "end", type: "end", name: "Selesai", actorIds: ["staff"] },
  ],
};
const taskFixture = documentFixture.steps[1] as TaskStep;
const decisionFixture = documentFixture.steps[2] as DecisionStep;

function App() {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState("a");
  const [date, setDate] = useState("2026-10-20");
  const [workflow, setWorkflow] = useState<"step" | "actor" | "decision" | null>(null);
  const [saved, setSaved] = useState(0);
  return (
    <div data-sopflow-root>
      <button type="button" id="open-modal" onClick={() => setOpen(true)}>
        Buka konfirmasi
      </button>
      <div style={{ width: 200, height: 48, overflow: "hidden" }}>
        <SopDatePicker
          value={date}
          onValueChange={setDate}
          label="Tanggal pembuatan"
        />
      </div>
      <output id="date-result">{date}</output>
      <button type="button" id="workflow-step" onClick={() => setWorkflow("step")}>
        Delete Step
      </button>
      <button type="button" id="workflow-actor" onClick={() => setWorkflow("actor")}>
        Delete Actor
      </button>
      <button type="button" id="workflow-decision" onClick={() => setWorkflow("decision")}>
        Edit Decision
      </button>
      <output id="workflow-count">{saved}</output>
      {workflow === "step" ? (
        <DeleteStepDialog
          open
          document={documentFixture}
          step={taskFixture}
          onOperations={() => setSaved((n) => n + 1)}
          onClose={() => setWorkflow(null)}
        />
      ) : null}
      {workflow === "actor" ? (
        <DeleteActorDialog
          open
          document={documentFixture}
          actor={documentFixture.actors[0]!}
          onOperations={() => setSaved((n) => n + 1)}
          onClose={() => setWorkflow(null)}
        />
      ) : null}
      {workflow === "decision" ? (
        <DecisionEditor
          open
          document={documentFixture}
          step={decisionFixture}
          onOperations={() => setSaved((n) => n + 1)}
          onClose={() => setWorkflow(null)}
        />
      ) : null}
      {open ? (
        <Dialog
          open
          title="Konfirmasi hapus langkah"
          description="Uji posisi modal di atas blur."
          onClose={() => setOpen(false)}
          footer={
            <button
              type="button"
              id="close-modal"
              onClick={() => setOpen(false)}
            >
              Batal
            </button>
          }
        >
          <Select
            compact
            label="Pilih cabang"
            value={choice}
            onValueChange={setChoice}
            options={[
              { value: "a", label: "Pertama" },
              { value: "b", label: "Kedua" },
            ]}
          />
        </Dialog>
      ) : null}
    </div>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Dialog source regression root missing");
createRoot(root).render(<App />);

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function report(status: "pass" | "fail", detail: string) {
  const output = document.createElement("output");
  output.dataset.dialogSourceRegression = status;
  output.textContent = detail;
  document.body.appendChild(output);
}

async function run() {
  await delay(220);
  const trigger = document.getElementById("open-modal");
  assert(trigger, "Missing dialog trigger");
  trigger.click();
  await delay(650);

  const content = document.querySelector<HTMLElement>('[role="dialog"]');
  assert(content, "Dialog content is missing after opening");
  const style = getComputedStyle(content);
  assert(style.position === "fixed", "Dialog is not fixed to the viewport");
  const overlay = Array.from(
    document.querySelectorAll<HTMLElement>("[data-sopflow-root]"),
  ).find((node) => {
    const computed = getComputedStyle(node);
    return (
      computed.backdropFilter.includes("blur") && computed.position === "fixed"
    );
  });
  assert(overlay, "Blur backdrop is not present");
  const overlayZ = Number(getComputedStyle(overlay).zIndex);
  const contentZ = Number(style.zIndex);
  assert(contentZ > overlayZ, "Modal content is behind blur overlay");

  const rect = content.getBoundingClientRect();
  assert(
    rect.width > 200 &&
      rect.height > 50 &&
      rect.top >= -1 &&
      rect.left >= -1 &&
      rect.bottom <= window.innerHeight + 1,
    "Modal content is clipped or offscreen",
  );
  const center = document.elementFromPoint(
    rect.left + rect.width / 2,
    rect.top + rect.height / 2,
  );
  assert(content.contains(center), "Modal is not topmost at its center");

  const combo = content.querySelector<HTMLButtonElement>('[role="combobox"]');
  assert(combo, "Nested Arc Select is missing");
  combo.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerType: "mouse",
      button: 0,
      ctrlKey: false,
    }),
  );
  await delay(400);
  const menu = document.querySelector<HTMLElement>('[role="listbox"]');
  assert(menu, "Nested Arc Select menu did not open");
  const popupParent = menu.parentElement;
  assert(popupParent, "Nested Select has no portal parent");
  assert(
    Number(getComputedStyle(menu).zIndex) > contentZ ||
      Number(getComputedStyle(popupParent).zIndex) > contentZ,
    "Nested Select menu cannot escape dialog layer",
  );

  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  await delay(300);
  const cancel = document.getElementById("close-modal");
  assert(cancel, "Missing cancel control");
  cancel.click();
  await delay(550);
  assert(!document.querySelector('[role="dialog"]'), "Dialog did not close");
  // Calendar portal must escape a clipped inspector while preserving ISO dates.
  const dateTrigger = document.querySelector<HTMLButtonElement>(
    '[aria-label="Tanggal pembuatan"]',
  );
  assert(dateTrigger, "Calendar trigger missing");
  dateTrigger.click();
  await delay(320);
  const calendar = document.querySelector<HTMLElement>(
    '[role="dialog"][aria-label="Tanggal pembuatan"]',
  );
  assert(calendar, "Styled calendar did not open");
  assert(
    calendar.parentElement === document.body,
    "Calendar was clipped inside inspector",
  );
  const popupBounds = calendar.getBoundingClientRect();
  assert(
    popupBounds.top >= 0 &&
      popupBounds.left >= 0 &&
      popupBounds.bottom <= window.innerHeight + 2,
    "Calendar popover overflowed viewport",
  );
  const day21 = Array.from(
    calendar.querySelectorAll<HTMLButtonElement>("button"),
  ).find((button) =>
    button.getAttribute("aria-label")?.includes("21 Oktober 2026"),
  );
  assert(day21, "Calendar day 21 is missing");
  day21.click();
  await delay(120);
  assert(
    document.getElementById("date-result")?.textContent === "2026-10-21",
    "Calendar selection did not preserve local ISO date",
  );
  assert(
    !document.querySelector('[role="dialog"]'),
    "Calendar remained open after selecting a date",
  );

  // Exercise the three actual SOP dialogs rather than only the generic fixture.
  const workflows = [
    { trigger: "workflow-step", title: "Hapus langkah", action: "Batal", save: false },
    { trigger: "workflow-actor", title: "Hapus pelaksana", action: "Hapus", save: true },
    { trigger: "workflow-decision", title: "Atur cabang keputusan", action: "Simpan", save: true },
  ];
  let saves = 0;
  for (const workflow of workflows) {
    const opener = document.getElementById(workflow.trigger);
    assert(opener, `Missing ${workflow.trigger} trigger`);
    opener.click();
    await delay(450);
    const dialog = Array.from(
      document.querySelectorAll<HTMLElement>('[role="dialog"],[role="alertdialog"]'),
    ).find((node) => node.textContent?.includes(workflow.title));
    assert(dialog, `Real ${workflow.title} dialog did not open`);
    const style = getComputedStyle(dialog);
    assert(style.position === "fixed" && Number(style.zIndex) > overlayZ,
      `Real ${workflow.title} is behind the blur`);
    const box = dialog.getBoundingClientRect();
    assert(box.width > 180 && box.height > 50, `Real ${workflow.title} is not visible`);
    const action = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === workflow.action);
    assert(action, `Real ${workflow.title} is missing ${workflow.action}`);
    assert(!action.disabled, `Real ${workflow.title} action is disabled`);
    action.click();
    await delay(460);
    assert(!Array.from(document.querySelectorAll('[role="dialog"],[role="alertdialog"]'))
      .some((node) => node.textContent?.includes(workflow.title)),
      `Real ${workflow.title} did not close`);
    if (workflow.save) saves++;
    assert(document.getElementById("workflow-count")?.textContent === String(saves),
      `Real ${workflow.title} did not preserve the intended SOP action`);
  }

  report(
    "pass",
    JSON.stringify({ contentZ, overlayZ, position: style.position }),
  );
}

run().catch((error: unknown) => {
  report("fail", error instanceof Error ? error.message : String(error));
});
