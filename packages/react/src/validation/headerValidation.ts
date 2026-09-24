import type { SOPDocument } from "@sopflow/core";
import {
  validateSopApHeader,
  type SopApHeaderField,
  type SopApHeaderValidationCode,
  type SopApHeaderValidationIssue,
} from "@sopflow/sop-ap";
import type { SopHeaderValue } from "../header/types.js";

export type SopHeaderField = SopApHeaderField;
export type SopHeaderValidationCode = SopApHeaderValidationCode;
export type SopHeaderValidationIssue = SopApHeaderValidationIssue;

export function validateSopHeader(
  document: SOPDocument,
  header: SopHeaderValue,
): SopHeaderValidationIssue[] {
  return validateSopApHeader(document, header);
}
