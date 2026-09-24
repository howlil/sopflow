import { getNextStepIds, getReachableStepIds } from "./graph.js";
import type { ActorId, SOPDocument, StepId } from "./types.js";

export type ValidationIssueCode =
  | "INVALID_START_COUNT"
  | "MISSING_END"
  | "DUPLICATE_STEP_ID"
  | "DUPLICATE_ACTOR_ID"
  | "INVALID_DECISION_BRANCH"
  | "UNKNOWN_ACTOR_REFERENCE"
  | "UNKNOWN_STEP_REFERENCE"
  | "UNREACHABLE_STEP"
  | "CANNOT_REACH_END"
  | "DUPLICATE_PRESENTATION_STEP"
  | "UNKNOWN_PRESENTATION_STEP"
  | "MISSING_PRESENTATION_STEP";

export interface ValidationIssue {
  readonly code: ValidationIssueCode;
  readonly message: string;
  readonly stepId?: StepId;
  readonly actorId?: ActorId;
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
    ...validateUniqueActorIds(document),
    ...validateDecisionBranches(document),
    ...validateActorReference(document),
    ...validateReference(document),
    ...validatePresentationOrder(document),
  );

  if (startSteps.length === 1) {
    issues.push(
      ...validateReachability(document),
      ...validateEndReachability(document),
    );
  }

  return issues;
}

export function validateDecisionBranches(
  document: SOPDocument,
): ValidationIssue[] {
  return document.steps.flatMap((step) => {
    if (step.type !== "decision") return [];

    const issues: ValidationIssue[] = [];

    if (!step.yes.trim()) {
      issues.push({
        code: "INVALID_DECISION_BRANCH",
        stepId: step.id,
        message: `Decision step "${step.id}" must have a Ya branch`,
      });
    }

    if (!step.no.trim()) {
      issues.push({
        code: "INVALID_DECISION_BRANCH",
        stepId: step.id,
        message: `Decision step "${step.id}" must have a Tidak branch`,
      });
    }

    return issues;
  });
}

export function validatePresentationOrder(
  document: SOPDocument,
): ValidationIssue[] {
  if (!document.presentationOrder) return [];

  const issues: ValidationIssue[] = [];
  const knownStepIds = new Set(document.steps.map((step) => step.id));
  const seen = new Set<StepId>();

  for (const stepId of document.presentationOrder) {
    if (seen.has(stepId)) {
      issues.push({
        code: "DUPLICATE_PRESENTATION_STEP",
        stepId,
        message: `Presentation order contains duplicate step "${stepId}"`,
      });
      continue;
    }

    seen.add(stepId);

    if (!knownStepIds.has(stepId)) {
      issues.push({
        code: "UNKNOWN_PRESENTATION_STEP",
        stepId,
        message: `Presentation order references unknown step "${stepId}"`,
      });
    }
  }

  for (const step of document.steps) {
    if (seen.has(step.id)) continue;
    issues.push({
      code: "MISSING_PRESENTATION_STEP",
      stepId: step.id,
      message: `Presentation order is missing step "${step.id}"`,
    });
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
      code: "UNREACHABLE_STEP" as const,
      stepId: step.id,
      message: `Step "${step.id}" cannot be reached from start`,
    }));
}

export function validateUniqueStepIds(
  document: SOPDocument,
): ValidationIssue[] {
  const seen = new Set<StepId>();
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

export function validateUniqueActorIds(
  document: SOPDocument,
): ValidationIssue[] {
  const seen = new Set<ActorId>();
  const issues: ValidationIssue[] = [];

  for (const actor of document.actors) {
    if (seen.has(actor.id)) {
      issues.push({
        code: "DUPLICATE_ACTOR_ID",
        actorId: actor.id,
        message: `Duplicate actor id "${actor.id}"`,
      });
    }

    seen.add(actor.id);
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
          actorId,
          message: `Step "${step.id}" references unknown actor "${actorId}"`,
        });
      }
    }
  }

  return issues;
}

export function validateEndReachability(
  document: SOPDocument,
): ValidationIssue[] {
  const canReachEnd = getStepIdsThatCanReachEnd(document);
  const issues: ValidationIssue[] = [];

  for (const step of document.steps) {
    if (step.type === "end") continue;

    if (!canReachEnd.has(step.id)) {
      issues.push({
        code: "CANNOT_REACH_END",
        stepId: step.id,
        message: `Step ${step.id} cannot reach any end step`,
      });
    }
  }

  return issues;
}

/** @deprecated Use validateEndReachability. */
export const validateEndReachbilty = validateEndReachability;

function getStepIdsThatCanReachEnd(document: SOPDocument): Set<StepId> {
  const reverse = new Map<StepId, StepId[]>();
  const stack: StepId[] = [];

  for (const step of document.steps) {
    reverse.set(step.id, []);

    if (step.type === "end") {
      stack.push(step.id);
    }
  }

  for (const step of document.steps) {
    for (const targetId of getNextStepIds(step)) {
      reverse.get(targetId)?.push(step.id);
    }
  }

  const reachable = new Set<StepId>();

  while (stack.length > 0) {
    const current = stack.pop();

    if (current === undefined || reachable.has(current)) continue;

    reachable.add(current);

    for (const previous of reverse.get(current) ?? []) {
      if (!reachable.has(previous)) {
        stack.push(previous);
      }
    }
  }

  return reachable;
}
