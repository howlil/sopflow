import { SOPDocumentSchema } from "./schema.js";

export interface SopSchemaIssue {
  readonly code: string;
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

/** Return schema diagnostics for drafts without throwing or requiring semantic validity. */
export function getSopSchemaIssues(document: unknown): SopSchemaIssue[] {
  const parsed = SOPDocumentSchema.safeParse(document);
  if (parsed.success) return [];
  return parsed.error.issues.map((issue) => ({
    code: issue.code,
    path: issue.path,
    message: issue.message,
  }));
}
