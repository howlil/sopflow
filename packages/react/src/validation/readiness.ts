import type { SOPDocument, ValidationIssue } from "@sopflow/core";
import {
  getSopApReadinessIssues,
  isSopApReady,
  type SopApReadinessIssue,
} from "@sopflow/sop-ap";
import type { SopHeaderValue } from "../header/types.js";

export type SopReadinessIssue = SopApReadinessIssue;

export function getSopReadinessIssues(
  document: SOPDocument,
  header: SopHeaderValue,
  graphIssues?: readonly ValidationIssue[],
): SopReadinessIssue[] {
  return getSopApReadinessIssues(document, header, graphIssues);
}

export function isSopReady(
  document: SOPDocument,
  header: SopHeaderValue,
): boolean {
  return isSopApReady(document, header);
}
