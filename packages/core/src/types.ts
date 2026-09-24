export type StepId = string;
export type ActorId = string;

export interface Actor {
  readonly id: ActorId;
  readonly name: string;
}

export interface Duration {
  readonly value: number;
  readonly unit: "minute" | "hour" | "day" | "week" | "month" | "year";
}

export interface StepBase {
  readonly id: StepId;
  readonly name: string;
  readonly actorIds: readonly ActorId[];
  readonly input?: string | undefined;
  readonly duration?: Duration | undefined;
  readonly output?: string | undefined;
  readonly note?: string | undefined;
}

export interface StartStep extends StepBase {
  readonly type: "start";
  readonly next: StepId;
}

export interface TaskStep extends StepBase {
  readonly type: "task";
  readonly next: StepId;
}

export interface DecisionStep extends StepBase {
  readonly type: "decision";
  readonly yes: StepId;
  readonly no: StepId;
}

export interface EndStep extends StepBase {
  readonly type: "end";
}

export type Step = StartStep | TaskStep | DecisionStep | EndStep;

export interface SOPDocument {
  readonly schemaVersion: "1";
  readonly id: string;
  readonly title: string;
  readonly actors: readonly Actor[];
  readonly steps: readonly Step[];
  /**
   * Optional authored/display order. Workflow execution remains defined only by
   * next/yes/no references. Legacy documents without this field fall back to a
   * deterministic graph-derived order.
   */
  readonly presentationOrder?: readonly StepId[];
}
