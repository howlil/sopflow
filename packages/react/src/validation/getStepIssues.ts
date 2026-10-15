import type { StepId } from "@sopflow/core";

export interface StepDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly stepId?: StepId;
}

export function getStepIssues(
  issues: readonly StepDiagnostic[],
  stepId: StepId,
): StepDiagnostic[] {
  return issues.filter((issue) => issue.stepId === stepId);
}

export function hasStepIssue(
  issues: readonly ValidationIssue[],
  stepId: StepId,
  codes?: string[],
): boolean {
  return issues.some((issue) => {
    if (issue.stepId !== stepId) {
      return false;
    }

    if (!codes) {
      return true;
    }

    return codes.includes(issue.code);
  });
}
