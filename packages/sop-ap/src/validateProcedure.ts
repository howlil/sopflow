import {
  getPresentationSteps,
  type SOPDocument,
  type StepId,
} from "@sopflow/core";

export type SopApProcedureValidationCode =
  | "MISSING_ACTOR"
  | "MISSING_STEP"
  | "INVALID_ACTOR_COUNT"
  | "MISSING_INPUT"
  | "MISSING_DURATION"
  | "MISSING_OUTPUT"
  | "MISSING_NOTE";

export interface SopApProcedureValidationIssue {
  readonly kind: "procedure";
  readonly code: SopApProcedureValidationCode;
  readonly message: string;
  readonly stepId?: StepId;
}

export function validateSopApProcedure(
  document: SOPDocument,
): SopApProcedureValidationIssue[] {
  const issues: SopApProcedureValidationIssue[] = [];

  if (document.actors.length === 0) {
    issues.push({
      kind: "procedure",
      code: "MISSING_ACTOR",
      message: "Tambahkan minimal satu aktor pelaksana",
    });
  }

  if (document.steps.length === 0) {
    issues.push({
      kind: "procedure",
      code: "MISSING_STEP",
      message: "Minimal satu langkah prosedur wajib ada",
    });
  }

  for (const [index, step] of getPresentationSteps(document).entries()) {
    const prefix = `Langkah ${index + 1}`;

    if (step.actorIds.length !== 1) {
      issues.push({
        kind: "procedure",
        code: "INVALID_ACTOR_COUNT",
        stepId: step.id,
        message: `${prefix}: SOP AP membutuhkan tepat satu pelaksana`,
      });
    }

    if (!step.input?.trim()) {
      issues.push({
        kind: "procedure",
        code: "MISSING_INPUT",
        stepId: step.id,
        message: `${prefix}: kelengkapan wajib diisi`,
      });
    }

    if (
      !step.duration ||
      !Number.isFinite(step.duration.value) ||
      step.duration.value < 0
    ) {
      issues.push({
        kind: "procedure",
        code: "MISSING_DURATION",
        stepId: step.id,
        message: `${prefix}: waktu wajib diisi`,
      });
    }

    if (!step.output?.trim()) {
      issues.push({
        kind: "procedure",
        code: "MISSING_OUTPUT",
        stepId: step.id,
        message: `${prefix}: keluaran wajib diisi`,
      });
    }

    if (!step.note?.trim()) {
      issues.push({
        kind: "procedure",
        code: "MISSING_NOTE",
        stepId: step.id,
        message: `${prefix}: keterangan wajib diisi`,
      });
    }
  }

  return issues;
}
