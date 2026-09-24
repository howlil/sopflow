import { SOPDocumentSchema } from "./schema.js";
import type { SOPDocument } from "./types.js";
import { validateSop, type ValidationIssue } from "./validate.js";

export type ParseSOPIssue =
  | {
      readonly source: "schema";
      readonly code: string;
      readonly path: readonly PropertyKey[];
      readonly message: string;
    }
  | {
      readonly source: "semantic";
      readonly issue: ValidationIssue;
    };

export interface ParseSOPSuccess {
  readonly success: true;
  readonly data: SOPDocument;
}

export interface ParseSOPFailure {
  readonly success: false;
  readonly errors: readonly string[];
  readonly issues: readonly ParseSOPIssue[];
}

export type ParseSOPResult = ParseSOPSuccess | ParseSOPFailure;

export function parseSop(input: unknown): ParseSOPResult {
  const parsed = SOPDocumentSchema.safeParse(input);

  if (!parsed.success) {
    const issues: ParseSOPIssue[] = parsed.error.issues.map((issue) => ({
      source: "schema",
      code: issue.code,
      path: issue.path,
      message: issue.message,
    }));

    return {
      success: false,
      errors: issues.map((issue) =>
        issue.source === "schema" ? issue.message : issue.issue.message,
      ),
      issues,
    };
  }

  const document: SOPDocument = {
    schemaVersion: parsed.data.schemaVersion,
    id: parsed.data.id,
    title: parsed.data.title,
    actors: parsed.data.actors,
    steps: parsed.data.steps,
    ...(parsed.data.presentationOrder !== undefined
      ? { presentationOrder: parsed.data.presentationOrder }
      : {}),
  };
  const semanticIssues = validateSop(document);

  if (semanticIssues.length > 0) {
    return {
      success: false,
      errors: semanticIssues.map((issue) => issue.message),
      issues: semanticIssues.map((issue) => ({
        source: "semantic",
        issue,
      })),
    };
  }

  return {
    success: true,
    data: document,
  };
}
