import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import type { Actor } from "@sopflow/core";
import { ActorField } from "./ActorField.js";

const actors: Actor[] = [
  { id: "staff", name: "Staff" },
  { id: "manager", name: "Manager" },
];

function Harness() {
  const [value, setValue] = useState<string[]>(["staff"]);

  return (
    <>
      <ActorField value={value} actors={actors} onChange={setValue} />
      <output data-testid="value">{value.join(",")}</output>
    </>
  );
}

describe("ActorField", () => {
  it("preserves and edits multiple actor assignments", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByRole("checkbox", { name: "Staff" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Manager" })).not.toBeChecked();

    await user.click(screen.getByRole("checkbox", { name: "Manager" }));
    expect(screen.getByTestId("value")).toHaveTextContent("staff,manager");

    await user.click(screen.getByRole("checkbox", { name: "Staff" }));
    expect(screen.getByTestId("value")).toHaveTextContent("manager");
  });

  it("renders every selected actor in read-only mode", () => {
    render(
      <ActorField
        value={["staff", "manager"]}
        actors={actors}
        onChange={() => undefined}
        readOnly
      />,
    );

    expect(screen.getByText("Staff, Manager")).toBeInTheDocument();
  });
});
