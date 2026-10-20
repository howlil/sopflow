import "../../../packages/react/src/styles/uiarc-scoped.css";
import "../../../packages/react/src/styles/token.css";
import button from "../../../packages/react/src/components/arc/button/button.module.css";
import input from "../../../packages/react/src/components/arc/input/input.module.css";
import select from "../../../packages/react/src/components/arc/select/select.module.css";
import multi from "../../../packages/react/src/components/arc/multi-select/multi-select.module.css";
import textarea from "../../../packages/react/src/components/arc/textarea/textarea.module.css";
import dropdown from "../../../packages/react/src/components/arc/dropdown-menu/dropdown-menu.module.css";
import dialog from "../../../packages/react/src/components/arc/dialog/dialog.module.css";
import header from "../../../packages/react/src/header/SopHeaderFields.module.css";
import toolbar from "../../../packages/react/src/editor/SopDocumentToolbar.module.css";
import status from "../../../packages/react/src/editor/EditorStatus.module.css";
import validation from "../../../packages/react/src/validation/ValidationPanel.module.css";
import decision from "../../../packages/react/src/steps/DecisionEditor.module.css";
import paper from "../../../packages/react/src/diagram/procedure/SopProcedureView.module.css";

const root = document.querySelector<HTMLElement>("#root");
if (!root) throw new Error("Missing browser test root");
root.setAttribute("data-sopflow-root", "");
root.style.cssText =
  "padding:20px;background:white;display:grid;gap:12px;width:500px";

function element(tag: string, className: string, parent = root) {
  const el = document.createElement(tag);
  el.className = className;
  parent.appendChild(el);
  return el;
}

function compact(tag: string, wrapper: string, control: string) {
  const field = element("div", wrapper);
  field.setAttribute("data-compact", "");
  return element(tag, control, field);
}

function radius(node: Element) {
  return getComputedStyle(node).borderTopLeftRadius;
}

function check(label: string, node: Element, expected: string) {
  const actual = radius(node);
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
  return `${label}=${actual}`;
}

const checks = [
  ["Arc button", element("button", button.button), "9999px"],
  ["Arc compact input", compact("input", input.field, input.input), "10px"],
  [
    "Arc compact select",
    compact("button", select.field, select.trigger),
    "10px",
  ],
  [
    "Arc compact multi-select",
    compact("button", multi.field, multi.trigger),
    "10px",
  ],
  [
    "Arc compact textarea",
    compact("textarea", textarea.field, textarea.control),
    "10px",
  ],
  ["Arc multiline textarea", element("textarea", textarea.control), "16px"],
  ["Editor toolbar", element("div", toolbar.toolbar), "9999px"],
  ["Editor toolbar button", element("button", toolbar.button), "9999px"],
  ["Editor toolbar tab", element("button", toolbar.tab), "9999px"],
  ["Logo preview", element("div", header.logoPreview), "16px"],
  ["Status notice", element("div", status.loading), "16px"],
  ["Validation panel", element("div", validation.root), "16px"],
  ["Decision metadata", element("div", decision.stepInfo), "10px"],
  ["Formal document table", element("table", paper.table), "0px"],
] as const;

const portal = document.createElement("div");
portal.setAttribute("data-sopflow-root", "");
document.body.appendChild(portal);
const portalChecks = [
  ["Arc dialog portal", element("div", dialog.content, portal), "16px"],
  ["Arc dropdown portal", element("div", dropdown.menu, portal), "14px"],
] as const;

const output = document.createElement("output");
try {
  const readings = [...checks, ...portalChecks].map(([name, node, expected]) =>
    check(name, node, expected),
  );
  output.setAttribute("data-react-radius-regression", "pass");
  output.textContent = JSON.stringify(readings);
} catch (error) {
  output.setAttribute("data-react-radius-regression", "fail");
  output.textContent = error instanceof Error ? error.message : String(error);
}
document.body.appendChild(output);
