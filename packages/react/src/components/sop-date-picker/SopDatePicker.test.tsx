import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { SopDatePicker } from "./SopDatePicker.js";
import { formatISODate, parseISODate } from "./date-utils.js";

describe("SopDatePicker", () => {
  it("rejects invalid ISO calendar dates without timezone normalization", () => {
    expect(parseISODate("2026-02-30")).toBeNull();
    expect(parseISODate("2025-02-29")).toBeNull();
    const leapDay = parseISODate("2024-02-29");
    if (!leapDay) throw new Error("Valid leap day rejected");
    expect(formatISODate(leapDay)).toBe("2024-02-29");
  });

  it("selects and clears a calendar date through a controlled value", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [date, setDate] = useState("2026-10-20");
      return (
        <>
          <SopDatePicker
            value={date}
            onValueChange={setDate}
            label="Tanggal pembuatan"
          />
          <output data-testid="date">{date || "empty"}</output>
        </>
      );
    }
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Tanggal pembuatan" }));
    expect(
      screen.getByRole("dialog", { name: "Tanggal pembuatan" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /21 Oktober 2026/i }));
    expect(screen.getByTestId("date")).toHaveTextContent("2026-10-21");

    await user.click(screen.getByRole("button", { name: "Tanggal pembuatan" }));
    await user.click(screen.getByRole("button", { name: "Kosongkan" }));
    expect(screen.getByTestId("date")).toHaveTextContent("empty");
  });

  it("keeps keyboard calendar navigation and Escape close available", async () => {
    const user = userEvent.setup();
    render(
      <SopDatePicker
        value="2026-10-20"
        onValueChange={() => {}}
        label="Tanggal efektif"
      />,
    );
    const trigger = screen.getByRole("button", { name: "Tanggal efektif" });
    await user.click(trigger);
    await user.keyboard("{ArrowRight}");
    expect(
      screen.getByRole("button", { name: /21 Oktober 2026/i }),
    ).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("commits the local calendar date when choosing Hari ini", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <SopDatePicker
        value="2026-10-20"
        onValueChange={onValueChange}
        label="Tanggal revisi"
      />,
    );
    const trigger = screen.getByRole("button", { name: "Tanggal revisi" });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Hari ini" }));
    expect(onValueChange).toHaveBeenCalledWith(formatISODate(new Date()));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("restores logical focus order for Tab and Shift+Tab from the portal", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Sebelum</button>
        <SopDatePicker
          value="2026-10-20"
          onValueChange={() => {}}
          label="Tanggal revisi"
        />
        <button type="button" hidden>
          Jangan difokuskan
        </button>
        <button type="button">Sesudah</button>
      </>,
    );
    const trigger = screen.getByRole("button", { name: "Tanggal revisi" });
    await user.click(trigger);
    await user.tab();
    expect(screen.getByRole("button", { name: "Sesudah" })).toHaveFocus();
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(trigger);
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Sebelum" })).toHaveFocus();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
