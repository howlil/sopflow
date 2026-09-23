import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormField } from "./FormField.js";

describe("FormField", () => {
  it("associates native controls when htmlFor is provided", () => {
    render(
      <FormField label="Nomor SOP" htmlFor="sop-number">
        <input id="sop-number" />
      </FormField>,
    );

    expect(screen.getByLabelText("Nomor SOP")).toHaveAttribute(
      "id",
      "sop-number",
    );
  });

  it("exposes a label id for composite controls", () => {
    render(
      <FormField label="Pelaksana" labelId="actor-label">
        <fieldset aria-labelledby="actor-label" />
      </FormField>,
    );

    expect(screen.getByText("Pelaksana")).toHaveAttribute("id", "actor-label");
  });
});
