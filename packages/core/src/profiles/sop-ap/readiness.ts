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
  const rawSchemaIssues = getSopSchemaIssues(document);
  const schemaIssues = rawSchemaIssues.map((issue) => ({
    ...issue,
    kind: "schema" as const,
  }));

  // Schema failures that change the runtime shape make downstream graph and
  // procedure traversal unsafe. Content-only draft failures (e.g. empty names)
  // must still collect contextual diagnostics for the editor.
  if (
    rawSchemaIssues.some(
      (issue) =>
        issue.code === "invalid_type" ||
        issue.code === "invalid_union" ||
        issue.code === "invalid_value",
    )
  ) {
    return schemaIssues;
  }

  return [
    ...schemaIssues,
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
