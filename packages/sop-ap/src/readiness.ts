import {
  validateSop,
  type SOPDocument,
  type ValidationIssue,
} from "@sopflow/core";
import type { SopApHeader } from "./types.js";
import {
  validateSopApHeader,
  type SopApHeaderValidationIssue,
} from "./validateHeader.js";
import {
  validateSopApProcedure,
  type SopApProcedureValidationIssue,
} from "./validateProcedure.js";

export type SopApReadinessIssue =
  | ({ readonly kind: "graph" } & ValidationIssue)
  | SopApHeaderValidationIssue
  | SopApProcedureValidationIssue;

export function getSopApReadinessIssues(
  document: SOPDocument,
  header: SopApHeader,
  graphIssues?: readonly ValidationIssue[],
): SopApReadinessIssue[] {
  return [
    ...(graphIssues ?? validateSop(document)).map((issue) => ({
      ...issue,
      kind: "graph" as const,
    })),
    ...validateSopApHeader(document, header),
    ...validateSopApProcedure(document),
  ];
}

export function isSopApReady(
  document: SOPDocument,
  header: SopApHeader,
): boolean {
  return getSopApReadinessIssues(document, header).length === 0;
}
