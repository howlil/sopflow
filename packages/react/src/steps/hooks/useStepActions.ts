import { useState } from "react";
import type { SOPDocument, SopOperation, Step } from "@sopflow/core";
import { createStepId } from "../../utils/createStepId.js";

export interface UseStepActionsOptions {
  step: Step;
  document: SOPDocument;
  onOperation: (operation: SopOperation) => void;
  onOperations: (operations: SopOperation[]) => void;
}

export function useStepActions({
  step,
  document,
  onOperation,
  onOperations,
}: UseStepActionsOptions) {
  const [isDecisionEditorOpen, setIsDecisionEditorOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  function updateStep(nextStep: Step) {
    onOperation({
      type: "update-step",
      step: nextStep,
    });
  }

  function changeStepType(type: "task" | "decision") {
    if (step.type === "start" || step.type === "end" || step.type === type) {
      return;
    }

    const { id, name, actorIds, input, duration, output, note } = step;

    if (step.type === "task" && type === "decision") {
      updateStep({
        id,
        type: "decision",
        name,
        actorIds,
        input,
        duration,
        output,
        note,
        yes: step.next,
        no: step.next,
      });

      return;
    }

    if (step.type === "decision" && type === "task") {
      updateStep({
        id,
        type: "task",
        name,
        actorIds,
        input,
        duration,
        output,
        note,
        next: step.yes,
      });
    }
  }

  function addAfter() {
    if (step.type !== "start" && step.type !== "task") {
      return;
    }

    const newStepId = createStepId();
    const newStep: Step = {
      id: newStepId,
      type: "task",
      name: "",
      actorIds: document.actors[0] ? [document.actors[0].id] : [],
      next: step.next,
    };

    onOperations([
      {
        type: "insert-step",
        step: newStep,
        afterStepId: step.id,
      },
      {
        type: "connect",
        from: step.id,
        to: newStepId,
      },
    ]);
  }

  function openDecisionEditor() {
    if (step.type !== "decision") {
      return;
    }

    setIsDecisionEditorOpen(true);
  }

  function closeDecisionEditor() {
    setIsDecisionEditorOpen(false);
  }

  function openDeleteDialog() {
    if (step.type === "start" || step.type === "end") {
      return;
    }

    setIsDeleteDialogOpen(true);
  }

  function closeDeleteDialog() {
    setIsDeleteDialogOpen(false);
  }

  return {
    updateStep,
    changeStepType,
    addAfter,
    isDecisionEditorOpen,
    openDecisionEditor,
    closeDecisionEditor,
    isDeleteDialogOpen,
    openDeleteDialog,
    closeDeleteDialog,
  };
}
