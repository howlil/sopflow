import { z } from "zod";

const RequiredText = z.string().trim().min(1);

export const ActorSchema = z.object({
  id: RequiredText,
  name: RequiredText,
});

export const DurationSchema = z.object({
  value: z.number().nonnegative(),
  unit: z.enum(["minute", "hour", "day", "week", "month", "year"]),
});

const StepBaseSchema = z.object({
  id: RequiredText,
  name: RequiredText,
  actorIds: z.array(z.string()),
  input: z.string().optional(),
  duration: DurationSchema.optional(),
  output: z.string().optional(),
  note: z.string().optional(),
});

export const StartStepSchema = StepBaseSchema.extend({
  type: z.literal("start"),
  next: RequiredText,
});

export const TaskStepSchema = StepBaseSchema.extend({
  type: z.literal("task"),
  next: RequiredText,
});

export const DecisionStepSchema = StepBaseSchema.extend({
  type: z.literal("decision"),
  yes: RequiredText,
  no: RequiredText,
});

export const EndStepSchema = StepBaseSchema.extend({
  type: z.literal("end"),
});

export const StepSchema = z.discriminatedUnion("type", [
  StartStepSchema,
  TaskStepSchema,
  DecisionStepSchema,
  EndStepSchema,
]);

export const SOPDocumentSchema = z.object({
  schemaVersion: z.literal("1"),
  id: RequiredText,
  title: RequiredText,
  actors: z.array(ActorSchema),
  steps: z.array(StepSchema),
  presentationOrder: z.array(RequiredText).optional(),
});
