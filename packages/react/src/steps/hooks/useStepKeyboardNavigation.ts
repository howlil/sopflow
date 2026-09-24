import { useCallback, type KeyboardEvent } from "react";
import {
  getPresentationSteps,
  type SOPDocument,
  type StepId,
} from "@sopflow/core";

export interface UseStepKeyboardNavigationOptions {
  document: SOPDocument;
  selectedStepId: StepId | null;
  onSelectedStepChange: (stepId: StepId | null) => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tagName = target.tagName.toLowerCase();

  return tagName === "input" || tagName === "textarea" || tagName === "select";
}

export function useStepKeyboardNavigation({
  document,
  selectedStepId,
  onSelectedStepChange,
}: UseStepKeyboardNavigationOptions) {
  return useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      const steps = getPresentationSteps(document);

      if (steps.length === 0) {
        return;
      }

      const firstStep = steps[0];
      const lastStep = steps[steps.length - 1];

      if (!firstStep || !lastStep) {
        return;
      }

      if (event.key === "Escape") {
        if (selectedStepId) {
          event.preventDefault();
          onSelectedStepChange(null);
        }

        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        onSelectedStepChange(firstStep.id);
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        onSelectedStepChange(lastStep.id);
        return;
      }

      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
        return;
      }

      event.preventDefault();

      const currentIndex = selectedStepId
        ? steps.findIndex((step) => step.id === selectedStepId)
        : -1;

      if (currentIndex === -1) {
        onSelectedStepChange(
          event.key === "ArrowUp" ? lastStep.id : firstStep.id,
        );
        return;
      }

      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = Math.min(
        Math.max(currentIndex + direction, 0),
        steps.length - 1,
      );

      const nextStep = steps[nextIndex];

      if (nextStep) {
        onSelectedStepChange(nextStep.id);
      }
    },
    [document, selectedStepId, onSelectedStepChange],
  );
}
