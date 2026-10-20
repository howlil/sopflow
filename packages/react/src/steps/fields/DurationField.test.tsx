import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import type { Duration } from "@sopflow/core";
import { DurationField } from "./DurationField.js";

function Harness() {
  const [value, setValue] = useState<Duration | undefined>();
  return (
    <>
      <DurationField value={value} onChange={setValue} />
      <output data-testid="duration">
        {value ? String(value.value) + " " + value.unit : "empty"}
      </output>
    </>
  );
}

describe("DurationField", () => {
  it("keeps the current unit across empty transitions without generating a zero value", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("combobox", { name: "Satuan waktu" }));
    await user.click(screen.getByRole("option", { name: "Jam" }));
    expect(screen.getByTestId("duration")).toHaveTextContent("empty");
    const amount = screen.getByRole("spinbutton", { name: "Jumlah waktu" });
    await user.type(amount, "3");
    expect(screen.getByTestId("duration")).toHaveTextContent("3 hour");
    await user.clear(amount);
    expect(screen.getByTestId("duration")).toHaveTextContent("empty");
    await user.type(amount, "5");
    expect(screen.getByTestId("duration")).toHaveTextContent("5 hour");
  });
});
