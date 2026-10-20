import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
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

    expect(screen.getByRole("option", { name: "Staff" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("option", { name: "Manager" })).toHaveAttribute(
      "aria-selected",
      "false",
    );

    await user.click(screen.getByRole("option", { name: "Manager" }));

    expect(screen.getByTestId("value")).toHaveTextContent("staff,manager");
    expect(trigger?.querySelector('[aria-hidden="true"]')).toHaveTextContent(
      "Staff+1",
    );

    await user.click(screen.getByRole("option", { name: "Staff" }));

    expect(screen.getByTestId("value")).toHaveTextContent("manager");
    expect(trigger).toHaveTextContent("Manager");
  });

  it("portals the listbox outside clipped procedure table containers", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <div style={{ overflow: "auto", height: 90 }}>
        <Harness />
      </div>,
    );
    const trigger = container.querySelector<HTMLElement>(
      "[data-sopflow-actor-trigger]",
    );
    expect(trigger).not.toBeNull();
    await user.click(trigger as HTMLElement);
    const menu = screen.getByRole("listbox", { name: "Pelaksana" });
    expect(menu.parentElement).toBe(document.body);
    expect(container.contains(menu)).toBe(false);
    expect(menu).toHaveAttribute("data-sopflow-root");

    await user.click(screen.getByRole("option", { name: "Manager" }));
    expect(screen.getByTestId("value")).toHaveTextContent("staff,manager");
    expect(menu).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
  });

  it("dismisses the portal on outside pointer presses", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Harness />
        <button type="button">Outside</button>
      </>,
    );
    await user.click(screen.getByRole("button", { name: /Pelaksana/ }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Outside" }));
    await waitFor(() =>
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
    );
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
    expect(screen.getByText("Staff +1")).toBeInTheDocument();
  });

  it("labels unnamed actors without dropping their stable IDs", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ActorField
        value={[]}
        actors={[
          { id: "unnamed-1", name: "" },
          { id: "unnamed-2", name: "   " },
        ]}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Pelaksana/ }));
    const first = screen.getByRole("option", {
      name: "Pelaksana belum diberi nama 1",
    });
    const second = screen.getByRole("option", {
      name: "Pelaksana belum diberi nama 2",
    });
    expect(second).toBeInTheDocument();
    await user.click(first);
    expect(onChange).toHaveBeenCalledWith(["unnamed-1"]);
  });
});
