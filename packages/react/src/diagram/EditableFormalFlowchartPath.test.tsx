import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EditableFormalFlowchartPath } from "./EditableFormalFlowchartPath.js";

const path = [
  { x: 100, y: 100 },
  { x: 140, y: 100 },
  { x: 140, y: 180 },
  { x: 220, y: 180 },
  { x: 220, y: 240 },
];

describe("EditableFormalFlowchartPath", () => {
  it("renders a wide route hit area and interior waypoint handles when selected", () => {
    const { container } = render(
      <svg>
        <title>Editable route test</title>
        <EditableFormalFlowchartPath
          path={path}
          connectionId="edge-1"
          selected
          sourceSide="bottom"
          targetSide="top"
          sourceRect={{ left: 80, top: 60, width: 40, height: 40 }}
          targetRect={{ left: 200, top: 240, width: 40, height: 40 }}
          onSelect={() => undefined}
          onChange={() => undefined}
        />
      </svg>,
    );

    expect(
      container.querySelector('[data-sopflow-editable-route="edge-1"]'),
    ).not.toBeNull();
    expect(
      container.querySelectorAll("[data-sopflow-route-waypoint]"),
    ).toHaveLength(3);
    expect(
      container.querySelectorAll("[data-sopflow-route-endpoint]"),
    ).toHaveLength(2);
  });

  it("does not show waypoint handles for an unselected route", () => {
    const { container } = render(
      <svg>
        <title>Editable route test</title>
        <EditableFormalFlowchartPath
          path={path}
          connectionId="edge-1"
          selected={false}
          sourceSide="bottom"
          targetSide="top"
          onSelect={() => undefined}
          onChange={() => undefined}
        />
      </svg>,
    );

    expect(
      container.querySelectorAll("[data-sopflow-route-waypoint]"),
    ).toHaveLength(0);
  });

  it("supports keyboard route selection and waypoint editing", () => {
    const onSelect = vi.fn();
    const onChange = vi.fn();

    render(
      <svg>
        <title>Editable route test</title>
        <EditableFormalFlowchartPath
          path={path}
          connectionId="edge-1"
          selected
          sourceSide="bottom"
          targetSide="top"
          onSelect={onSelect}
          onChange={onChange}
        />
      </svg>,
    );

    const route = screen.getByRole("button", { name: "Edit route edge-1" });
    fireEvent.keyDown(route, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("edge-1");

    const waypoint = screen.getByRole("button", {
      name: "Waypoint 1 route edge-1",
    });
    fireEvent.keyDown(waypoint, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalled();

    fireEvent.keyDown(waypoint, { key: "Delete" });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("does not reset a selected route while typing in an input", () => {
    const onReset = vi.fn();

    render(
      <>
        <input aria-label="Kegiatan" />
        <svg>
          <title>Editable route test</title>
          <EditableFormalFlowchartPath
            path={path}
            connectionId="edge-1"
            selected
            onSelect={() => undefined}
            onChange={() => undefined}
            onReset={onReset}
          />
        </svg>
      </>,
    );

    const input = screen.getByRole("textbox", { name: "Kegiatan" });
    input.focus();
    fireEvent.keyDown(input, { key: "Backspace" });

    expect(onReset).not.toHaveBeenCalled();
  });

  it("resets the selected manual route with Delete", () => {
    const onReset = vi.fn();

    render(
      <svg>
        <title>Editable route test</title>
        <EditableFormalFlowchartPath
          path={path}
          connectionId="edge-1"
          selected
          sourceSide="bottom"
          targetSide="top"
          onSelect={() => undefined}
          onChange={() => undefined}
          onReset={onReset}
        />
      </svg>,
    );

    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete" }));

    expect(onReset).toHaveBeenCalledOnce();
  });
});
