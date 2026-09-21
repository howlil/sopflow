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
  });

  it("does not show waypoint handles for an unselected route", () => {
    const { container } = render(
      <svg>
        <title>Editable route test</title>
        <EditableFormalFlowchartPath
          path={path}
          connectionId="edge-1"
          selected={false}
          onSelect={() => undefined}
          onChange={() => undefined}
        />
      </svg>,
    );

    expect(
      container.querySelectorAll("[data-sopflow-route-waypoint]"),
    ).toHaveLength(0);
  });

  it("renders endpoint handles and emits snapped endpoint anchors", () => {
    const onEndpointChange = vi.fn();

    render(
      <svg>
        <title>Editable route test</title>
        <EditableFormalFlowchartPath
          path={path}
          connectionId="edge-1"
          selected
          endpointTargets={{
            start: { left: 60, top: 80, width: 40, height: 40 },
            end: { left: 220, top: 220, width: 40, height: 40 },
          }}
          onSelect={() => undefined}
          onChange={() => undefined}
          onEndpointChange={onEndpointChange}
        />
      </svg>,
    );

    expect(
      screen.getByRole("button", { name: "Start endpoint route edge-1" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "End endpoint route edge-1" }),
    ).toBeInTheDocument();

    fireEvent.keyDown(
      screen.getByRole("button", { name: "Start endpoint route edge-1" }),
      { key: "ArrowLeft" },
    );

    expect(onEndpointChange).toHaveBeenCalledWith("start", {
      side: "right",
      distance: 0.5,
    });
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
