import { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../../packages/react/src/styles/uiarc-scoped.css";
import "../../../packages/react/src/styles/token.css";
import { Dialog } from "../../../packages/react/src/primitives/Dialog.tsx";
import { Select } from "../../../packages/react/src/components/arc/select/select.tsx";

function App() {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState("a");
  return (
    <div data-sopflow-root>
      <button type="button" id="open-modal" onClick={() => setOpen(true)}>
        Buka konfirmasi
      </button>
      {open ? (
        <Dialog
          open
          title="Konfirmasi hapus langkah"
          description="Uji posisi modal di atas blur."
          onClose={() => setOpen(false)}
          footer={
            <button type="button" id="close-modal" onClick={() => setOpen(false)}>
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
    return computed.backdropFilter.includes("blur") && computed.position === "fixed";
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
  assert(
    Number(getComputedStyle(menu).zIndex) > contentZ ||
      Number(getComputedStyle(menu.parentElement!).zIndex) > contentZ,
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
  report("pass", JSON.stringify({ contentZ, overlayZ, position: style.position }));
}

run().catch((error: unknown) => {
  report("fail", error instanceof Error ? error.message : String(error));
});
