import type { ActorId, StepId } from "./types.js";
import type { ValidationIssue } from "./validate.js";

export type CoreErrorCode =
  | "DUPLICATE_STEP_ID"
  | "DUPLICATE_ACTOR_ID"
  | "ACTOR_NOT_FOUND"
  | "ACTOR_IN_USE"
  | "STEP_NOT_FOUND"
  | "SOURCE_STEP_NOT_FOUND"
  | "TARGET_STEP_NOT_FOUND"
  | "REFERENCED_STEP"
  | "INVALID_STEP_CONNECTION"
  | "UNKNOWN_ACTOR_REFERENCE"
  | "INVALID_OPERATION"
  | "INVALID_DOCUMENT";

export interface CoreErrorDetails {
  readonly stepId?: StepId;
  readonly actorId?: ActorId;
  readonly sourceId?: StepId;
  readonly targetId?: StepId;
  readonly issues?: readonly ValidationIssue[];
  readonly operationErrors?: readonly string[];
}

export class SopCoreError extends Error {
  readonly name = "SopCoreError";
  readonly code: CoreErrorCode;
  readonly details: CoreErrorDetails | undefined;

  constructor(
    code: CoreErrorCode,
    message: string,
    details?: CoreErrorDetails,
  ) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export function isSopCoreError(error: unknown): error is SopCoreError {
  return error instanceof SopCoreError;
}

export function invalidDocumentError(
  issues: readonly ValidationIssue[],
): SopCoreError {
  return new SopCoreError(
    "INVALID_DOCUMENT",
    "Operation would produce an invalid SOP document",
    { issues },
  );
}
