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
  it("replaces the existing actor and dismisses the picker", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    const trigger = container.querySelector<HTMLElement>(
      "[data-sopflow-actor-trigger]",
    );
    expect(trigger).not.toBeNull();
    expect(trigger).toHaveTextContent("Staff");

    await user.click(trigger as HTMLElement);
    expect(
      screen.getByRole("listbox", { name: "Pelaksana" }),
    ).not.toHaveAttribute("aria-multiselectable", "true");
    await user.click(screen.getByRole("option", { name: "Manager" }));
    expect(screen.getByTestId("value")).toHaveTextContent("manager");
    expect(trigger).toHaveTextContent("Manager");
    await waitFor(() =>
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
    );
  });

  it("does not emit a duplicate change when reselecting the current actor", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ActorField value={["staff"]} actors={actors} onChange={onChange} />,
    );

    await user.click(screen.getByRole("button", { name: /Pelaksana/ }));
    await user.click(screen.getByRole("option", { name: "Staff" }));

    expect(onChange).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
    );
  });

  it("keeps the listbox outside the clipped procedure table", async () => {
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
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
  });

  it("dismisses the picker on an outside pointer press", async () => {
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

  it("does not silently discard a legacy multi-actor assignment", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ActorField
        value={["staff", "manager"]}
        actors={actors}
        onChange={onChange}
      />,
    );
    expect(
      screen.getByText(/Beberapa pelaksana terdeteksi/),
    ).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /Pelaksana/ }));
    await user.click(screen.getByRole("option", { name: "Manager" }));
    expect(onChange).toHaveBeenCalledWith(["manager"]);
  });

  it("preserves all legacy actor labels in read-only mode", () => {
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

  it("keeps disabled legacy labels visible without enabling edits", () => {
    render(
      <ActorField
        value={["staff", "manager"]}
        actors={actors}
        onChange={() => undefined}
        disabled
      />,
    );
    expect(screen.getByText("Staff +1")).toBeInTheDocument();
  });

  it("uses stable IDs for unnamed actors", async () => {
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
    await user.click(
      screen.getByRole("option", { name: "Pelaksana belum diberi nama 1" }),
    );
    expect(onChange).toHaveBeenCalledWith(["unnamed-1"]);
  });
});
