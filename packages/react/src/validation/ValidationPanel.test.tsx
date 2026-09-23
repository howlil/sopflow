import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ValidationPanel } from "./ValidationPanel.js";

describe("ValidationPanel", () => {
  it("keeps blocking readiness issues compact until expanded", async () => {
    const user = userEvent.setup();

    render(
      <ValidationPanel
        issues={[
          {
            kind: "header",
            code: "MISSING_HEADER_VALUE",
            field: "number",
            message: "Nomor SOP harus diisi",
          },
        ]}
      />,
    );

    expect(screen.getByText("1 masalah")).toBeInTheDocument();
    expect(screen.queryByText("Nomor SOP harus diisi")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Lihat masalah" }));

    expect(screen.getByText("Nomor SOP harus diisi")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sembunyikan masalah" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("reports a ready document", () => {
    render(<ValidationPanel issues={[]} />);

    expect(screen.getByText("Siap")).toBeInTheDocument();
    expect(
      screen.getByText(/header dan alur sop lengkap/i),
    ).toBeInTheDocument();
  });
});
