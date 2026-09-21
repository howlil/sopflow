import { z } from "zod";
import { ActorSchema, StepSchema } from "./schema.js";
import type { SopOperation } from "./operations.js";

const RequiredId = z.string().trim().min(1);

const AddActorOperationSchema = z.object({
  type: z.literal("add-actor"),
  actor: ActorSchema,
});

const UpdateActorOperationSchema = z.object({
  type: z.literal("update-actor"),
  actor: ActorSchema,
});

const RemoveActorOperationSchema = z.object({
  type: z.literal("remove-actor"),
  actorId: RequiredId,
});

const AddStepOperationSchema = z.object({
  type: z.literal("add-step"),
  step: StepSchema,
});

const InsertStepOperationSchema = z.object({
  type: z.literal("insert-step"),
  step: StepSchema,
  afterStepId: RequiredId,
});

const InsertStepBeforeOperationSchema = z.object({
  type: z.literal("insert-step-before"),
  step: StepSchema,
  beforeStepId: RequiredId,
});

const UpdateStepOperationSchema = z.object({
  type: z.literal("update-step"),
  step: StepSchema,
});

const RemoveStepOperationSchema = z.object({
  type: z.literal("remove-step"),
  stepId: RequiredId,
});

const ConnectOperationSchema = z.object({
  type: z.literal("connect"),
  from: RequiredId,
  to: RequiredId,
});

const ConnectDecisionOperationSchema = z.object({
  type: z.literal("connect-decision"),
  from: RequiredId,
  branch: z.enum(["yes", "no"]),
  to: RequiredId,
});

export const SopOperationSchema = z.discriminatedUnion("type", [
  AddActorOperationSchema,
  UpdateActorOperationSchema,
  RemoveActorOperationSchema,
  AddStepOperationSchema,
  InsertStepOperationSchema,
  InsertStepBeforeOperationSchema,
  UpdateStepOperationSchema,
  RemoveStepOperationSchema,
  ConnectOperationSchema,
  ConnectDecisionOperationSchema,
]);

export interface ParseOperationIssue {
  readonly code: string;
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

export interface ParseOperationSuccess {
  readonly success: true;
  readonly data: SopOperation;
}

export interface ParseOperationFailure {
  readonly success: false;
  readonly errors: readonly string[];
  readonly issues: readonly ParseOperationIssue[];
}

export type ParseOperationResult =
  | ParseOperationSuccess
  | ParseOperationFailure;

export function parseSopOperation(input: unknown): ParseOperationResult {
  const result = SopOperationSchema.safeParse(input);

  if (!result.success) {
    const issues: ParseOperationIssue[] = result.error.issues.map((issue) => ({
      code: issue.code,
      path: issue.path,
      message: issue.message,
    }));

    return {
      success: false,
      errors: issues.map((issue) => issue.message),
      issues,
    };
  }

  return { success: true, data: result.data };
}
