import { z } from "zod";
import { ActorSchema, StepSchema } from "./schema.js";
import type { SopOperation } from "./operations.js";

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
  actorId: z.string().trim().min(1),
});

const AddStepOperationSchema = z.object({
  type: z.literal("add-step"),
  step: StepSchema,
});

const InsertStepOperationSchema = z.object({
  type: z.literal("insert-step"),
  step: StepSchema,
  afterStepId: z.string().trim().min(1),
});

const InsertStepBeforeOperationSchema = z.object({
  type: z.literal("insert-step-before"),
  step: StepSchema,
  beforeStepId: z.string().trim().min(1),
});

const UpdateStepOperationSchema = z.object({
  type: z.literal("update-step"),
  step: StepSchema,
});

const RemoveStepOperationSchema = z.object({
  type: z.literal("remove-step"),
  stepId: z.string().trim().min(1),
});

const ConnectOperationSchema = z.object({
  type: z.literal("connect"),
  from: z.string().trim().min(1),
  to: z.string().trim().min(1),
});

const ConnectDecisionOperationSchema = z.object({
  type: z.literal("connect-decision"),
  from: z.string().trim().min(1),
  branch: z.enum(["yes", "no"]),
  to: z.string().trim().min(1),
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

export interface ParseOperationSuccess {
  success: true;
  data: SopOperation;
}

export interface ParseOperationFailure {
  success: false;
  errors: string[];
}

export type ParseOperationResult =
  | ParseOperationSuccess
  | ParseOperationFailure;

export function parseSopOperation(input: unknown): ParseOperationResult {
  const result = SopOperationSchema.safeParse(input);

  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map((issue) => issue.message),
    };
  }

  return { success: true, data: result.data };
}
