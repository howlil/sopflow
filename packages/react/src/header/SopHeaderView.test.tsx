import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { SOPDocument } from "@sopflow/core";
import type { SopHeaderValue } from "../types.js";
import { SopHeaderView } from "./SopHeaderView.js";

const document: SOPDocument = {
  schemaVersion: "1",
  id: "header-view",
  title: "Pelayanan Administrasi",
  actors: [],
  steps: [],
};

const header: SopHeaderValue = {
  number: "001/SOP/2026",
  institutionName: "Pemerintah Provinsi\nSekretariat Daerah",
  createdDate: "2026-09-21",
  revisionDate: "",
  effectiveDate: "",
  signatory: {
    name: "Budi",
    role: "Kepala OPD",
    identifier: "12345",
  },
  lawBasis: ["PermenPANRB 35/2012"],
  qualifications: ["Memahami administrasi"],
  relatedSops: [],
  equipment: ["Komputer"],
  warnings: [],
  records: ["Buku agenda"],
};

describe("SopHeaderView", () => {
  it("renders document metadata without exposing editing controls", () => {
    const { container } = render(
      <SopHeaderView document={document} header={header} />,
    );

    const view = container.querySelector("[data-sopflow-header-view]");

    expect(view).not.toBeNull();
    expect(view?.querySelector("input, textarea, button")).toBeNull();
    expect(screen.getByText("Pelayanan Administrasi")).toBeInTheDocument();
    expect(screen.getByText("001/SOP/2026")).toBeInTheDocument();
    expect(screen.getByText("21/09/2026")).toBeInTheDocument();
    expect(screen.getByText("Pemerintah Provinsi")).toBeInTheDocument();
    expect(screen.getByText("Sekretariat Daerah")).toBeInTheDocument();
    expect(screen.getByText("Kepala OPD")).toBeInTheDocument();
    expect(screen.getByText("NIP. 12345")).toBeInTheDocument();
  });
});
