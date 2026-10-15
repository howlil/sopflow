import { SOPDocumentSchema } from "./schema.js";

export interface SopSchemaIssue {
  readonly code: string;
  readonly stepId?: string;
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

/** Return schema diagnostics for drafts without throwing or requiring semantic validity. */
export function getSopSchemaIssues(document: unknown): SopSchemaIssue[] {
  const parsed = SOPDocumentSchema.safeParse(document);
  if (parsed.success) return [];
  return parsed.error.issues.map((issue) => {
    const [collection, index] = issue.path;
    const step =
      collection === "steps" &&
      typeof index === "number" &&
      document !== null &&
      typeof document === "object" &&
      "steps" in document &&
      Array.isArray(document.steps)
        ? document.steps[index]
        : undefined;
    const stepId =
      step !== null &&
      typeof step === "object" &&
      "id" in step &&
      typeof step.id === "string"
        ? step.id
        : undefined;
    return {
      code: issue.code,
      path: issue.path,
      message: issue.message,
      ...(stepId ? { stepId } : {}),
    };
  });
}
