import { getPresentationSteps, parseSop, type SOPDocument } from "@sopflow/core";

export interface SopTaCompatibilityIssue {
  readonly code:
    | "EMPTY_PROCEDURE"
    | "AMBIGUOUS_TERMINATOR"
    | "MULTIPLE_ENDS"
    | "INVALID_START_POSITION"
    | "INVALID_END_POSITION"
    | "INVALID_ACTOR_COUNT"
    | "NON_SEQUENTIAL_TASK"
    | "INVALID_DOCUMENT";
  readonly message: string;
  readonly stepId?: string;
}

export function validateSopTaCompatibility(
  document: SOPDocument,
): SopTaCompatibilityIssue[] {
  const ordered = getPresentationSteps(document);
  const issues: SopTaCompatibilityIssue[] = [];
  const parsed = parseSop(document);
  if (!parsed.success) {
    issues.push({
      code: "INVALID_DOCUMENT",
      message: `SOP document is invalid: ${parsed.errors.join("; ")}`,
    });
  }

  if (ordered.length < 2) {
    issues.push({
      code: "EMPTY_PROCEDURE",
      message: "sop-ta requires at least start and end procedure rows",
    });
    return issues;
  }

  const starts = ordered.filter((step) => step.type === "start");
  const ends = ordered.filter((step) => step.type === "end");

  if (starts.length !== 1 || starts[0]?.id !== ordered[0]?.id) {
    issues.push({
      code: "INVALID_START_POSITION",
      message: "sop-ta requires exactly one start row at the beginning",
      ...(starts[0] ? { stepId: starts[0].id } : {}),
    });
  }

  if (ends.length !== 1) {
    issues.push({
      code: "MULTIPLE_ENDS",
      message: "sop-ta compatibility requires exactly one end row",
    });
  } else if (ends[0]?.id !== ordered.at(-1)?.id) {
    issues.push({
      code: "INVALID_END_POSITION",
      message: "sop-ta requires the end row to be last",
      ...(ends[0] ? { stepId: ends[0].id } : {}),
    });
  }

  ordered.forEach((step, index) => {
    if (step.actorIds.length !== 1) {
      issues.push({
        code: "INVALID_ACTOR_COUNT",
        message: `Step "${step.id}" must have exactly one sop-ta pelaksana`,
        stepId: step.id,
      });
    }

    if (step.type === "start" || step.type === "task") {
      const expectedNext = ordered[index + 1]?.id;
      if (step.next !== expectedNext) {
        issues.push({
          code: "NON_SEQUENTIAL_TASK",
          message: `Step "${step.id}" cannot be exported losslessly because its next target is not the following authored row`,
          stepId: step.id,
        });
      }
    }
  });

  return issues;
}
