import { validateSop, type ValidationIssue } from "../../validate.js";
import {
  getSopSchemaIssues,
  type SopSchemaIssue,
} from "../../schemaValidation.js";
import type { SOPDocument } from "../../types.js";
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
  | ({ readonly kind: "schema" } & SopSchemaIssue)
  | ({ readonly kind: "graph" } & ValidationIssue)
  | SopApHeaderValidationIssue
  | SopApProcedureValidationIssue;

export function getSopApReadinessIssues(
  document: SOPDocument,
  header: SopApHeader,
  graphIssues?: readonly ValidationIssue[],
): SopApReadinessIssue[] {
  return [
    ...getSopSchemaIssues(document).map((issue) => ({
      ...issue,
      kind: "schema" as const,
    })),
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
