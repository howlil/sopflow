import { useState } from "react";
import {
  buildChangeStepTypeOperations,
  buildInsertTaskAfterOperations,
  type SOPDocument,
  type SopOperation,
  type Step,
} from "@sopflow/core";
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
    const operations = buildChangeStepTypeOperations(document, step.id, type);

    if (operations.length === 1 && operations[0]) {
      onOperation(operations[0]);
      return;
    }

    if (operations.length > 1) {
      onOperations(operations);
    }
  }

  function addAfter() {
    if (step.type !== "start" && step.type !== "task") {
      return;
    }

    onOperations(
      buildInsertTaskAfterOperations(document, step.id, createStepId()),
    );
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
