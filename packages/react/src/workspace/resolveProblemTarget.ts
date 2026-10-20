import type { SopReadinessIssue } from "../validation/readiness.js";

export type ProblemTarget =
  | { readonly kind: "header"; readonly field: string }
  | { readonly kind: "step"; readonly stepId: string }
  | { readonly kind: "actors" }
  | { readonly kind: "steps" }
  | { readonly kind: "summary" };

const headerFields = new Set([
  "institutionName",
  "number",
  "title",
  "createdDate",
  "revisionDate",
  "effectiveDate",
  "lawBasis",
  "qualifications",
  "relatedSops",
  "equipment",
  "warnings",
  "records",
]);

export function resolveProblemTarget(issue: SopReadinessIssue): ProblemTarget {
  if (issue.kind === "header") {
    return { kind: "header", field: issue.field };
  }

  if (issue.kind === "procedure") {
    if (issue.stepId) return { kind: "step", stepId: issue.stepId };
    if (issue.code === "MISSING_ACTOR") return { kind: "actors" };
    if (issue.code === "MISSING_STEP") return { kind: "steps" };
  }

  if (issue.kind === "graph") {
    if (issue.stepId) return { kind: "step", stepId: issue.stepId };
    return { kind: "summary" };
  }

  if (issue.kind === "schema") {
    if (issue.stepId) return { kind: "step", stepId: issue.stepId };
    const [section, field] = issue.path;
    if (section === "header" && typeof field === "string" && headerFields.has(field)) {
      return { kind: "header", field };
    }
    if (section === "steps") return { kind: "steps" };
    if (section === "actors") return { kind: "actors" };
  }

  return { kind: "summary" };
}

export function problemKey(issue: SopReadinessIssue): string {
  const detail =
    issue.kind === "schema"
      ? issue.path.join(".")
      : "field" in issue
        ? issue.field
        : (issue.stepId ?? "");
  return [issue.kind, issue.code, detail, issue.message].join(":");
}
