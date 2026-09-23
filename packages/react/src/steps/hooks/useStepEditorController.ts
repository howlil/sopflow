import type { Step, ValidationIssue } from "@sopflow/core";
import { getStepIssues, hasStepIssue } from "../../validation/getStepIssues.js";
import {
  useStepActions,
  type UseStepActionsOptions,
} from "./useStepActions.js";

export type StepEditorControllerOptions = UseStepActionsOptions & {
  issues: readonly ValidationIssue[];
};

export function useStepEditorController({
  step,
  document,
  issues,
  onOperation,
  onOperations,
}: StepEditorControllerOptions) {
  const actions = useStepActions({
    step,
    document,
    onOperation,
    onOperations,
  });

  const stepIssues = getStepIssues(issues, step.id);
  const hasActorError = hasStepIssue(issues, step.id, [
    "UNKNOWN_ACTOR_REFERENCE",
  ]);
  const hasWorkflowError = hasStepIssue(issues, step.id, [
    "UNKNOWN_STEP_REFERENCE",
    "CANNOT_REACH_END",
    "UNREACHABLE_STEP",
  ]);

  function updateName(name: string) {
    actions.updateStep({ ...step, name });
  }

  function updateActorIds(actorIds: string[]) {
    actions.updateStep({ ...step, actorIds });
  }

  function updateInput(input: string) {
    actions.updateStep({ ...step, input: input || undefined });
  }

  function updateDuration(duration: Step["duration"]) {
    actions.updateStep({ ...step, duration });
  }

  function updateOutput(output: string) {
    actions.updateStep({ ...step, output: output || undefined });
  }

  function updateNote(note: string) {
    actions.updateStep({ ...step, note: note || undefined });
  }

  return {
    ...actions,
    stepIssues,
    hasActorError,
    hasWorkflowError,
    hasError: stepIssues.length > 0 || hasWorkflowError,
    updateName,
    updateActorIds,
    updateInput,
    updateDuration,
    updateOutput,
    updateNote,
  };
}
