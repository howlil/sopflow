export type StepId = string;
export type ActorId = string;

export interface Actor {
  id: ActorId;
  name: string;
}

export interface Duration {
  value: number;
  unit: "minute" | "hour" | "day" | "week" | "month" | "year";
}

export interface StepBase {
  id: StepId;
  name: string;
  actorIds: ActorId[];
  input?: string | undefined;
  duration?: Duration | undefined;
  output?: string | undefined;
  note?: string | undefined;
}

export interface StartStep extends StepBase {
  type: "start";
  next: StepId;
}

export interface TaskStep extends StepBase {
  type: "task";
  next: StepId;
}

export interface DecisionStep extends StepBase {
  type: "decision";
  yes: StepId;
  no: StepId;
}

export interface EndStep extends StepBase {
  type: "end";
}

export type Step = StartStep | TaskStep | DecisionStep | EndStep;

export interface SOPDocument {
  schemaVersion: "1";
  id: string;
  title: string;
  actors: Actor[];
  steps: Step[];
}
