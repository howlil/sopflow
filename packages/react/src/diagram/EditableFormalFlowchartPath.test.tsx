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

  it("previews a segment drag locally and persists exactly once on pointerup", () => {
    const onChange = vi.fn();
    const { container } = render(
      <svg viewBox="0 0 400 300">
        <title>Manual route transaction test</title>
        <EditableFormalFlowchartPath
          path={path}
          connectionId="edge-1"
          selected
          sourceSide="right"
          targetSide="top"
          onSelect={() => undefined}
          onChange={onChange}
        />
      </svg>,
    );
    const svg = container.querySelector("svg");
    const hitPath = screen.getByRole("button", { name: "Edit route edge-1" });
    expect(svg).not.toBeNull();
    if (!svg) throw new Error("Missing SVG");
    Object.defineProperty(svg, "viewBox", {
      configurable: true,
      value: { baseVal: { x: 0, y: 0, width: 400, height: 300 } },
    });
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 400,
      bottom: 300,
      width: 400,
      height: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(hitPath, {
      pointerId: 1,
      button: 0,
      clientX: 140,
      clientY: 140,
    });
    fireEvent.pointerMove(hitPath, {
      pointerId: 1,
      clientX: 160,
      clientY: 140,
    });

    expect(onChange).not.toHaveBeenCalled();
    expect(
      container.querySelector("[data-sopflow-manual-route-preview]"),
    ).not.toBeNull();

    fireEvent.pointerUp(hitPath, { pointerId: 1 });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector("[data-sopflow-manual-route-preview]"),
    ).toBeNull();
  });

  it("discards canceled drags without changing persisted diagram config", () => {
    const onChange = vi.fn();
    const { container } = render(
      <svg viewBox="0 0 400 300">
        <title>Manual route cancel test</title>
        <EditableFormalFlowchartPath
          path={path}
          connectionId="edge-1"
          selected
          sourceSide="right"
          targetSide="top"
          onSelect={() => undefined}
          onChange={onChange}
        />
      </svg>,
    );
    const svg = container.querySelector("svg");
    const hitPath = screen.getByRole("button", { name: "Edit route edge-1" });
    if (!svg) throw new Error("Missing SVG");
    Object.defineProperty(svg, "viewBox", {
      configurable: true,
      value: { baseVal: { x: 0, y: 0, width: 400, height: 300 } },
    });
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 400,
      bottom: 300,
      width: 400,
      height: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(hitPath, {
      pointerId: 1,
      button: 0,
      clientX: 140,
      clientY: 140,
    });
    fireEvent.pointerMove(hitPath, {
      pointerId: 1,
      clientX: 160,
      clientY: 140,
    });
    fireEvent.pointerCancel(hitPath, { pointerId: 1 });

    expect(onChange).not.toHaveBeenCalled();
    expect(
      container.querySelector("[data-sopflow-manual-route-preview]"),
    ).toBeNull();
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

  it("resets the selected manual route with Delete only when route is focused", () => {
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

    const route = screen.getByRole("button", { name: "Edit route edge-1" });
    fireEvent.keyDown(route, { key: "Delete" });

    expect(onReset).toHaveBeenCalledOnce();

    // A keyboard shortcut outside this route must not mutate the diagram.
    const unrelated = document.createElement("button");
    document.body.append(unrelated);
    fireEvent.keyDown(unrelated, { key: "Delete" });
    expect(onReset).toHaveBeenCalledOnce();
    unrelated.remove();
  });
});
