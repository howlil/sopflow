import { describe, expect, it } from "vitest";
import type { SOPDocument } from "@sopflow/core";
import type { SopHeaderValue } from "../header/types.js";
import { validateSopHeader } from "./headerValidation.js";

const document: SOPDocument = {
  schemaVersion: "1",
  id: "header-validation",
  title: "Pengajuan Dokumen",
  actors: [],
  steps: [],
};

const validHeader: SopHeaderValue = {
  number: "SOP/001",
  institutionName: "Sopflow Demo",
  logoUrl: "logo.svg",
  createdDate: "2026-09-20",
  revisionDate: "2026-09-20",
  effectiveDate: "2026-09-20",
  signatory: {
    role: "Manajer",
    name: "Pemilik SOP",
    identifier: "NIP-001",
  },
  lawBasis: ["PermenPANRB 35/2012"],
  qualifications: ["Memahami prosedur"],
  relatedSops: ["—"],
  equipment: ["Komputer"],
  warnings: ["—"],
  records: ["Formulir pengajuan"],
};

describe("validateSopHeader", () => {
  it("accepts a complete SOP AP header", () => {
    expect(validateSopHeader(document, validHeader)).toEqual([]);
  });

  it("reports missing identity and quality fields", () => {
    const issues = validateSopHeader(document, {
      ...validHeader,
      number: "",
      lawBasis: [],
      records: [],
    });

    expect(issues.map((issue) => issue.field)).toEqual(
      expect.arrayContaining(["number", "lawBasis", "records"]),
    );
  });

  it("rejects impossible dates", () => {
    const issues = validateSopHeader(document, {
      ...validHeader,
      effectiveDate: "2026-02-31",
    });

    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "INVALID_HEADER_DATE",
        field: "effectiveDate",
      }),
    );
  });
});
