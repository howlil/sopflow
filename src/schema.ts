import { z } from "zod";

export const ActorSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const DurationSchema = z.object({
  value: z.number(),
  unit: z.enum(["minute", "hour", "day", "week", "month", "year"]),
});

export const StepBaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  actorIds: z.array(z.string()),
  input: z.string().optional(),
  duration: DurationSchema.optional(),
  output: z.string().optional(),
  note: z.string().optional(),
});

export const StartStepSchema = StepBaseSchema.extend({
  type: z.literal("start"),
  next: z.string(),
});

export const TaskStepSchema = StepBaseSchema.extend({
  type: z.literal("task"),
  next: z.string(),
});

export const DecisionStepSchema = StepBaseSchema.extend({
  type: z.literal("decision"),
  yes: z.string(),
  no: z.string(),
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
  id: z.string(),
  title: z.string(),
  actors: z.array(ActorSchema),
  steps: z.array(StepSchema),
});
