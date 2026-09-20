import type { StepId, ValidationIssue } from "@sopflow/core";

export function getStepIssues(
  issues: ValidationIssue[],
  stepId: StepId,
): ValidationIssue[] {
  return issues.filter((issue) => issue.stepId === stepId);
}

export function hasStepIssue(
  issues: ValidationIssue[],
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
