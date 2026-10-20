import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Dialog } from "./Dialog.js";

describe("SOPFlow Dialog", () => {
  it("renders actions as a sibling footer outside the form body", () => {
    render(
      <Dialog
        open
        title="Hapus langkah"
        onClose={() => {}}
        footer={
          <button type="button" data-sopflow-cancel>
            Batal
          </button>
        }
      >
        <p>Isi konfirmasi</p>
      </Dialog>,
    );

    const dialog = screen.getByRole("dialog", { name: "Hapus langkah" });
    const footer = dialog.querySelector("footer");
    expect(footer).not.toBeNull();
    expect(footer?.parentElement).toBe(dialog);
    expect(footer?.previousElementSibling).toContainElement(
      screen.getByText("Isi konfirmasi"),
    );
    expect(footer).toContainElement(
      screen.getByRole("button", { name: "Batal" }),
    );
  });
});
