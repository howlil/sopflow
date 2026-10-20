import type { SopReadinessIssue } from "../validation/readiness.js";

export type StepProblemField =
  | "name"
  | "actorIds"
  | "input"
  | "duration"
  | "output"
  | "note"
  | "decisionRoutes";
export type ProblemTarget =
  | { readonly kind: "header"; readonly field: string }
  | {
      readonly kind: "step";
      readonly stepId: string;
      readonly field?: StepProblemField;
    }
  | { readonly kind: "actors" }
  | { readonly kind: "steps" }
  | { readonly kind: "summary" };

const procedureFields: Partial<Record<string, StepProblemField>> = {
  INVALID_ACTOR_COUNT: "actorIds",
  MISSING_ACTIVITY: "name",
  MISSING_INPUT: "input",
  MISSING_OUTPUT: "output",
  MISSING_NOTE: "note",
  IDENTICAL_DECISION_TARGETS: "decisionRoutes",
};
const schemaFields: Readonly<Record<string, StepProblemField>> = {
  name: "name",
  actorIds: "actorIds",
  input: "input",
  duration: "duration",
  output: "output",
  note: "note",
  yes: "decisionRoutes",
  no: "decisionRoutes",
  next: "decisionRoutes",
};

export function resolveProblemTarget(issue: SopReadinessIssue): ProblemTarget {
  if (issue.kind === "header") return { kind: "header", field: issue.field };
  if (issue.kind === "procedure") {
    if (issue.stepId) {
      const field = procedureFields[issue.code];
      return {
        kind: "step",
        stepId: issue.stepId,
        ...(field ? { field } : {}),
      };
    }
    if (issue.code === "MISSING_ACTOR") return { kind: "actors" };
    if (issue.code === "MISSING_STEP") return { kind: "steps" };
  }
  if (issue.kind === "graph") {
    if (issue.stepId) {
      const field =
        issue.code === "UNKNOWN_ACTOR_REFERENCE"
          ? "actorIds"
          : issue.code === "UNKNOWN_STEP_REFERENCE" ||
              issue.code === "INVALID_DECISION_BRANCH"
            ? "decisionRoutes"
            : undefined;
      return {
        kind: "step",
        stepId: issue.stepId,
        ...(field ? { field } : {}),
      };
    }
    if (issue.code === "DUPLICATE_ACTOR_ID") return { kind: "actors" };
    if (
      issue.code === "DUPLICATE_PRESENTATION_STEP" ||
      issue.code === "MISSING_PRESENTATION_STEP" ||
      issue.code === "UNKNOWN_PRESENTATION_STEP"
    ) return { kind: "steps" };
  }
  if (issue.kind === "schema") {
    if (issue.stepId) {
      const candidate = issue.path[2];
      const field =
        typeof candidate === "string" ? schemaFields[candidate] : undefined;
      return {
        kind: "step",
        stepId: issue.stepId,
        ...(field ? { field } : {}),
      };
    }
    const [section, field] = issue.path;
    if (section === "header" && typeof field === "string") {
      return { kind: "header", field };
    }
    if (section === "actors") return { kind: "actors" };
    if (section === "steps") return { kind: "steps" };
    if (section === "title") return { kind: "header", field: "title" };
  }
  return { kind: "summary" };
}

export function findProblemTarget(
  root: HTMLElement,
  target: ProblemTarget,
): HTMLElement | null {
  if (target.kind === "summary") return null;
  if (target.kind === "actors")
    return root.querySelector<HTMLElement>("[data-sopflow-actors]");
  if (target.kind === "steps")
    return root.querySelector<HTMLElement>(
      '[aria-label="Navigasi langkah SOP"]',
    );
  if (target.kind === "header") {
    return (
      Array.from(
        root.querySelectorAll<HTMLElement>("[data-sopflow-header-field]"),
      ).find((node) => node.dataset.sopflowHeaderField === target.field) ?? null
    );
  }
  const matches = Array.from(
    root.querySelectorAll<HTMLElement>("[data-sopflow-step-id]"),
  ).filter((node) => node.dataset.sopflowStepId === target.stepId);
  const visible =
    matches.find((node) => node.getClientRects().length > 0) ?? matches[0];
  if (!visible) return null;
  if (!target.field) return visible;
  return (
    Array.from(
      visible.querySelectorAll<HTMLElement>("[data-sopflow-step-field]"),
    ).find((node) => node.dataset.sopflowStepField === target.field) ?? visible
  );
}

/** Focus the specific control when it exists; otherwise focus its containing surface. */
export function focusProblemTarget(
  root: HTMLElement,
  target: ProblemTarget,
): boolean {
  const anchor = findProblemTarget(root, target);
  if (!anchor) return false;
  anchor.scrollIntoView?.({
    behavior: "auto",
    block: "nearest",
    inline: "nearest",
  });
  const focusable = anchor.matches(
    "input, textarea, button, select, [tabindex]",
  )
    ? anchor
    : anchor.querySelector<HTMLElement>(
        'input:not(:disabled), textarea:not(:disabled), button:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );
  const element = focusable ?? anchor;
  if (
    element === anchor &&
    !element.matches("input, textarea, button, select, [tabindex]")
  ) {
    element.setAttribute("tabindex", "-1");
  }
  element.focus({ preventScroll: true });
  return true;
}

export function problemKey(issue: SopReadinessIssue): string {
  const detail =
    issue.kind === "schema"
      ? issue.path.map(String).join(".")
      : "field" in issue
        ? issue.field
        : (issue.stepId ?? "");
  return [issue.kind, issue.code, detail, issue.message].join(":");
}
