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
  it("keeps multi-actor assignment compact until opened", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    const trigger = container.querySelector<HTMLElement>(
      "[data-sopflow-actor-trigger]",
    );

    expect(trigger).not.toBeNull();
    expect(trigger).toHaveTextContent("Staff");

    await user.click(trigger as HTMLElement);

    expect(screen.getByRole("checkbox", { name: "Staff" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Manager" })).not.toBeChecked();

    await user.click(screen.getByRole("checkbox", { name: "Manager" }));

    expect(screen.getByTestId("value")).toHaveTextContent("staff,manager");
    expect(trigger).toHaveTextContent("Staff +1");

    await user.click(screen.getByRole("checkbox", { name: "Staff" }));

    expect(screen.getByTestId("value")).toHaveTextContent("manager");
    expect(trigger).toHaveTextContent("Manager");
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

  it("renders a non-interactive compact value when disabled", () => {
    const { container } = render(
      <ActorField
        value={["staff", "manager"]}
        actors={actors}
        onChange={() => undefined}
        disabled
      />,
    );

    expect(container.querySelector("details")).toBeNull();
    expect(screen.getByLabelText("Pelaksana")).toHaveTextContent("Staff +1");
  });
});
