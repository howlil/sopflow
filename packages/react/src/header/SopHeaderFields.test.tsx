import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import type { SOPDocument } from "@sopflow/core";
import type { SopHeaderValue } from "../types.js";
import { SopHeaderFields } from "./SopHeaderFields.js";

const initialDocument: SOPDocument = {
  schemaVersion: "1",
  id: "header-fields",
  title: "SOP Awal",
  actors: [],
  steps: [],
};

const initialHeader: SopHeaderValue = {
  number: "001",
  institutionName: "Instansi",
  createdDate: "",
  revisionDate: "",
  effectiveDate: "",
  lawBasis: [],
  qualifications: [],
  relatedSops: [],
  equipment: [],
  warnings: [],
  records: [],
};

function Harness() {
  const [document, setDocument] = useState(initialDocument);
  const [header, setHeader] = useState(initialHeader);

  return (
    <>
      <SopHeaderFields
        document={document}
        header={header}
        onDocumentChange={setDocument}
        onHeaderChange={setHeader}
      />
      <output data-testid="title">{document.title}</output>
      <output data-testid="number">{header.number}</output>
      <output data-testid="law-count">{header.lawBasis.length}</output>
    </>
  );
}

describe("SopHeaderFields", () => {
  it("updates controlled header and document values", async () => {
    const user = userEvent.setup();

    render(<Harness />);

    const title = screen.getByLabelText("Nama SOP");
    const number = screen.getByLabelText("Nomor SOP");

    await user.clear(title);
    await user.type(title, "SOP Baru");
    await user.clear(number);
    await user.type(number, "002");
    await user.click(
      screen.getByRole("button", { name: "Tambah dasar hukum" }),
    );

    expect(screen.getByTestId("title")).toHaveTextContent("SOP Baru");
    expect(screen.getByTestId("number")).toHaveTextContent("002");
    expect(screen.getByTestId("law-count")).toHaveTextContent("1");
  });

  it("remains independently usable in read-only composition", () => {
    render(
      <SopHeaderFields
        document={initialDocument}
        header={initialHeader}
        disabled
      />,
    );

    expect(screen.getByLabelText("Nama SOP")).toBeDisabled();
    expect(screen.getByLabelText("Nomor SOP")).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Tambah dasar hukum" }),
    ).not.toBeInTheDocument();
  });
});
