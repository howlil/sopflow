import type { SOPDocument } from "@sopflow/core";
import type { SopApHeader } from "./types.js";

export type SopApHeaderField =
  | "institutionName"
  | "number"
  | "createdDate"
  | "revisionDate"
  | "effectiveDate"
  | "title"
  | "lawBasis"
  | "qualifications"
  | "relatedSops"
  | "equipment"
  | "warnings"
  | "records";

export type SopApHeaderValidationCode =
  | "MISSING_HEADER_VALUE"
  | "MISSING_HEADER_LIST"
  | "INVALID_HEADER_DATE";

export interface SopApHeaderValidationIssue {
  readonly kind: "header";
  readonly code: SopApHeaderValidationCode;
  readonly field: SopApHeaderField;
  readonly message: string;
}

export function validateSopApHeader(
  document: SOPDocument,
  header: SopApHeader,
): SopApHeaderValidationIssue[] {
  const issues: SopApHeaderValidationIssue[] = [];

  requiredText(
    issues,
    "institutionName",
    header.institutionName,
    "Nama instansi",
  );
  requiredText(issues, "number", header.number, "Nomor SOP");
  requiredText(issues, "title", document.title, "Judul SOP");

  for (const [field, value, label] of [
    ["createdDate", header.createdDate, "Tanggal pembuatan"],
    ["revisionDate", header.revisionDate, "Tanggal revisi"],
    ["effectiveDate", header.effectiveDate, "Tanggal efektif"],
  ] as const) {
    if (value && !isIsoDate(value)) {
      issues.push({
        kind: "header",
        code: "INVALID_HEADER_DATE",
        field,
        message: `${label} harus menggunakan format YYYY-MM-DD`,
      });
    }
  }

  for (const [field, label] of [
    ["lawBasis", "Dasar hukum"],
    ["qualifications", "Kualifikasi pelaksana"],
    ["relatedSops", "Keterkaitan SOP"],
    ["equipment", "Peralatan/perlengkapan"],
    ["warnings", "Peringatan"],
    ["records", "Pencatatan dan pendataan"],
  ] as const) {
    if (header[field].some((item) => item.trim())) continue;

    issues.push({
      kind: "header",
      code: "MISSING_HEADER_LIST",
      field,
      message: `${label} harus diisi`,
    });
  }

  return issues;
}

function requiredText(
  issues: SopApHeaderValidationIssue[],
  field: "institutionName" | "number" | "title",
  value: string,
  label: string,
): void {
  if (value.trim()) return;

  issues.push({
    kind: "header",
    code: "MISSING_HEADER_VALUE",
    field,
    message: `${label} harus diisi`,
  });
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
  );
}
