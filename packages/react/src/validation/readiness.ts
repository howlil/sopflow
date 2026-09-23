import {
  validateSop,
  type SOPDocument,
  type ValidationIssue,
} from "@sopflow/core";
import type { SopHeaderValue } from "../types.js";
import {
  validateSopHeader,
  type SopHeaderValidationIssue,
} from "./headerValidation.js";

export type SopReadinessIssue =
  | ({ readonly kind: "graph" } & ValidationIssue)
  | SopHeaderValidationIssue;

export function getSopReadinessIssues(
  document: SOPDocument,
  header: SopHeaderValue,
  graphIssues?: readonly ValidationIssue[],
): SopReadinessIssue[] {
  return [
    ...(graphIssues ?? validateSop(document)).map((issue) => ({
      ...issue,
      kind: "graph" as const,
    })),
    ...validateSopHeader(document, header),
  ];
}

export function isSopReady(
  document: SOPDocument,
  header: SopHeaderValue,
): boolean {
  return getSopReadinessIssues(document, header).length === 0;
}
