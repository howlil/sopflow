import { getNextStepIds, getReachableStepIds } from "./graph.js";
import type { SOPDocument } from "./types.js";

export interface ValidationIssue {
  code: string;
  message: string;
  stepId?: string;
}

export function validateSop(document: SOPDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const startSteps = document.steps.filter((step) => step.type === "start");

  if (startSteps.length !== 1) {
    issues.push({
      code: "INVALID_START_COUNT",
      message: "SOP must contain exactly one start step",
    });
  }

  const endSteps = document.steps.filter((step) => step.type === "end");

  if (endSteps.length === 0) {
    issues.push({
      code: "MISSING_END",
      message: "SOP must contain at least one end step",
    });
  }

  issues.push(
    ...validateUniqueStepIds(document),
    ...validateActorReference(document),
    ...validateReference(document),
  );

  if (startSteps.length === 1) {
    issues.push(...validateReachability(document));
  }

  return issues;
}

export function validateReference(document: SOPDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const ids = new Set(document.steps.map((step) => step.id));

  for (const step of document.steps) {
    for (const nextId of getNextStepIds(step)) {
      if (!ids.has(nextId)) {
        issues.push({
          code: "UNKNOWN_STEP_REFERENCE",
          stepId: step.id,
          message: `Step "${step.id}" points to unknown step "${nextId}"`,
        });
      }
    }
  }

  return issues;
}

export function validateReachability(document: SOPDocument): ValidationIssue[] {
  const reachable = getReachableStepIds(document);

  return document.steps
    .filter((step) => !reachable.has(step.id))
    .map((step) => ({
      code: "UNREACHABLE_STEP",
      stepId: step.id,
      message: `Step "${step.id}" cannot be reached from start`,
    }));
}

export function validateUniqueStepIds(
  document: SOPDocument,
): ValidationIssue[] {
  const seen = new Set<string>();
  const issues: ValidationIssue[] = [];

  for (const step of document.steps) {
    if (seen.has(step.id)) {
      issues.push({
        code: "DUPLICATE_STEP_ID",
        stepId: step.id,
        message: `Duplicate step id "${step.id}"`,
      });
    }
    seen.add(step.id);
  }

  return issues;
}

export function validateActorReference(
  document: SOPDocument,
): ValidationIssue[] {
  const actorIds = new Set(document.actors.map((actor) => actor.id));

  const issues: ValidationIssue[] = [];

  for (const step of document.steps) {
    for (const actorId of step.actorIds) {
      if (!actorIds.has(actorId)) {
        issues.push({
          code: "UNKNOWN_ACTOR_REFERENCE",
          stepId: step.id,
          message: `Step "${step.id}" references unknown actor "${actorId}"`,
        });
      }
    }
  }

  return issues;
}
