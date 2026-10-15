import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button.js";

describe("SOPFlow Arc UI Button compatibility", () => {
  it("keeps native button events and default secondary behavior", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Tambah langkah</Button>);
    const button = screen.getByRole("button", { name: "Tambah langkah" });
    expect(button.hasAttribute("data-sopflow-root")).toBe(true);
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
  it("keeps disabled and native button attributes", () => {
    const onClick = vi.fn();
    render(<Button type="button" size="default" variant="danger" disabled onClick={onClick}>Hapus</Button>);
    const button = screen.getByRole("button", { name: "Hapus" });
    expect(button.hasAttribute("disabled")).toBe(true);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
