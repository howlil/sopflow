import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import type { SOPDocument } from "@sopflow/core";
import type { SopHeaderValue } from "./types.js";
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
      <output data-testid="logo">{header.logoUrl ?? ""}</output>
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
    const logo = screen.getByLabelText("Logo instansi");

    await user.clear(title);
    await user.type(title, "SOP Baru");
    await user.clear(number);
    await user.type(number, "002");
    const logoFile = new File(["logo"], "logo.png", { type: "image/png" });
    await user.upload(logo, logoFile);
    await user.click(
      screen.getByRole("button", { name: "Tambah dasar hukum" }),
    );

    expect(screen.getByTestId("title")).toHaveTextContent("SOP Baru");
    expect(screen.getByTestId("number")).toHaveTextContent("002");
    await waitFor(() =>
      expect(screen.getByTestId("logo")).toHaveTextContent(
        "data:image/png;base64,",
      ),
    );
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
    expect(screen.getByLabelText("Logo instansi")).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Tambah dasar hukum" }),
    ).not.toBeInTheDocument();
  });

  it("resizes institution and SOP title fields when controlled content expands or shrinks", async () => {
    const original = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "scrollHeight",
    );
    Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
      configurable: true,
      get() {
        return (this as HTMLTextAreaElement).value.includes("\n") ? 168 : 36;
      },
    });
    try {
      const user = userEvent.setup();
      render(<Harness />);
      const institution = screen.getByRole("textbox", { name: "Nama lembaga" });
      const title = screen.getByRole("textbox", { name: "Nama SOP" });
      expect(institution).toHaveStyle({ height: "36px", overflowY: "hidden" });
      expect(title).toHaveStyle({ height: "36px" });

      await user.type(institution, "{end}{enter}Alamat panjang");
      expect(institution).toHaveStyle({ height: "144px", overflowY: "auto" });
      await user.clear(institution);
      expect(institution).toHaveStyle({ height: "36px", overflowY: "hidden" });

      await user.type(title, "{end}{enter}Deskripsi");
      expect(title).toHaveStyle({ height: "144px" });
      await user.clear(title);
      expect(title).toHaveStyle({ height: "36px" });
    } finally {
      if (original)
        Object.defineProperty(
          HTMLTextAreaElement.prototype,
          "scrollHeight",
          original,
        );
      else {
        Reflect.deleteProperty(HTMLTextAreaElement.prototype, "scrollHeight");
      }
    }
  });
});
