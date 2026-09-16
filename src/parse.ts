import { SOPDocumentSchema } from "./schema.js";
import type { SOPDocument } from "./types.js";
import { validateSop } from "./validate.js";

export interface ParseSOPSuccess {
  success: true;
  data: SOPDocument;
}

export interface ParseSOPFailure {
  success: false;
  errors: string[];
}

export type ParseSOPResult = ParseSOPSuccess | ParseSOPFailure;

export function parseSop(input: unknown): ParseSOPResult {
  const parsed = SOPDocumentSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.issues.map((issue) => issue.message),
    };
  }

  const semanticIssues = validateSop(parsed.data);

  if (semanticIssues.length > 0) {
    return {
      success: false,
      errors: semanticIssues.map((issue) => issue.message),
    };
  }

  return {
    success: true,
    data: parsed.data,
  };
}
