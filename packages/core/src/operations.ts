import type { Actor, ActorId, SOPDocument, Step, StepId } from "./types.js";
import { SopCoreError, invalidDocumentError } from "./errors.js";
import { parseSopOperation } from "./operation-schema.js";
import { validateSop } from "./validate.js";
import {
  addActor,
  updateActor,
  removeActor,
  addStep,
  insertStep,
  insertStepBefore,
  removeStep,
  updateStep,
  connectStep,
  connectDecisionBranch,
} from "./mutate.js";

export type SopOperation =
  | {
      readonly type: "add-actor";
      readonly actor: Actor;
    }
  | {
      readonly type: "update-actor";
      readonly actor: Actor;
    }
  | {
      readonly type: "remove-actor";
      readonly actorId: ActorId;
    }
  | {
      readonly type: "add-step";
      readonly step: Step;
    }
  | {
      readonly type: "insert-step";
      readonly step: Step;
      readonly afterStepId: StepId;
    }
  | {
      readonly type: "insert-step-before";
      readonly step: Step;
      readonly beforeStepId: StepId;
    }
  | {
      readonly type: "update-step";
      readonly step: Step;
    }
  | {
      readonly type: "remove-step";
      readonly stepId: StepId;
    }
  | {
      readonly type: "connect";
      readonly from: StepId;
      readonly to: StepId;
    }
  | {
      readonly type: "connect-decision";
      readonly from: StepId;
      readonly branch: "yes" | "no";
      readonly to: StepId;
    };

export function applyOperation(
  document: SOPDocument,
  operation: SopOperation,
): SOPDocument {
  switch (operation.type) {
    case "add-actor":
      return addActor(document, operation.actor);

    case "update-actor":
      return updateActor(document, operation.actor);

    case "remove-actor":
      return removeActor(document, operation.actorId);

    case "add-step":
      return addStep(document, operation.step);

    case "insert-step":
      return insertStep(document, operation.step, operation.afterStepId);

    case "insert-step-before":
      return insertStepBefore(document, operation.step, operation.beforeStepId);

    case "update-step":
      return updateStep(document, operation.step);

    case "remove-step":
      return removeStep(document, operation.stepId);

    case "connect":
      return connectStep(document, operation.from, operation.to);

    case "connect-decision":
      return connectDecisionBranch(
        document,
        operation.from,
        operation.branch,
        operation.to,
      );
  }
}

export function applyOperations(
  document: SOPDocument,
  operations: readonly SopOperation[],
): SOPDocument {
  return operations.reduce<SOPDocument>(
    (current, operation) => applyOperation(current, operation),
    document,
  );
}

export function applyValidatedOperations(
  document: SOPDocument,
  operations: readonly SopOperation[],
): SOPDocument {
  const nextDocument = applyOperations(document, operations);
  const issues = validateSop(nextDocument);

  if (issues.length > 0) {
    throw invalidDocumentError(issues);
  }

  return nextDocument;
}

export function applyOperationInput(
  document: SOPDocument,
  input: unknown,
): SOPDocument {
  const parsed = parseSopOperation(input);

  if (!parsed.success) {
    throw new SopCoreError("INVALID_OPERATION", "Operation input is invalid", {
      operationErrors: parsed.errors,
    });
  }

  return applyOperation(document, parsed.data);
}
