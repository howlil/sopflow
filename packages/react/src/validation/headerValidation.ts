import type { SOPDocument } from "@sopflow/core";
import type { SopHeaderValue } from "../header/types.js";

export type SopHeaderField =
  | "institutionName"
  | "logoUrl"
  | "number"
  | "createdDate"
  | "revisionDate"
  | "effectiveDate"
  | "signatory"
  | "title"
  | "lawBasis"
  | "qualifications"
  | "relatedSops"
  | "equipment"
  | "warnings"
  | "records";

export type SopHeaderValidationCode =
  | "MISSING_HEADER_VALUE"
  | "MISSING_HEADER_LIST"
  | "INVALID_HEADER_DATE";

export interface SopHeaderValidationIssue {
  readonly kind: "header";
  readonly code: SopHeaderValidationCode;
  readonly field: SopHeaderField;
  readonly message: string;
}

export function validateSopHeader(
  document: SOPDocument,
  header: SopHeaderValue,
): SopHeaderValidationIssue[] {
  const issues: SopHeaderValidationIssue[] = [];

  requiredText(
    issues,
    "institutionName",
    header.institutionName,
    "Nama instansi",
  );
  requiredText(issues, "logoUrl", header.logoUrl ?? "", "Logo instansi");
  requiredText(issues, "number", header.number, "Nomor SOP");
  requiredText(issues, "title", document.title, "Judul SOP");
  requiredText(issues, "createdDate", header.createdDate, "Tanggal pembuatan");
  requiredText(issues, "revisionDate", header.revisionDate, "Tanggal revisi");
  requiredText(
    issues,
    "effectiveDate",
    header.effectiveDate,
    "Tanggal efektif",
  );

  if (header.createdDate && !isIsoDate(header.createdDate)) {
    issues.push({
      kind: "header",
      code: "INVALID_HEADER_DATE",
      field: "createdDate",
      message: "Tanggal pembuatan harus menggunakan format YYYY-MM-DD",
    });
  }

  if (header.revisionDate && !isIsoDate(header.revisionDate)) {
    issues.push({
      kind: "header",
      code: "INVALID_HEADER_DATE",
      field: "revisionDate",
      message: "Tanggal revisi harus menggunakan format YYYY-MM-DD",
    });
  }

  if (header.effectiveDate && !isIsoDate(header.effectiveDate)) {
    issues.push({
      kind: "header",
      code: "INVALID_HEADER_DATE",
      field: "effectiveDate",
      message: "Tanggal efektif harus menggunakan format YYYY-MM-DD",
    });
  }

  const signatory = header.signatory;
  if (
    !signatory?.role?.trim() ||
    !signatory.name.trim() ||
    !signatory.identifier?.trim()
  ) {
    issues.push({
      kind: "header",
      code: "MISSING_HEADER_VALUE",
      field: "signatory",
      message: "Pengesahan harus memiliki jabatan, nama, dan nomor identitas",
    });
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
  issues: SopHeaderValidationIssue[],
  field: Extract<
    SopHeaderField,
    | "institutionName"
    | "logoUrl"
    | "number"
    | "createdDate"
    | "revisionDate"
    | "effectiveDate"
    | "title"
  >,
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
