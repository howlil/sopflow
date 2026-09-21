import { render } from "@testing-library/react";
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

  it("resets the selected manual route with Delete", () => {
    const onReset = vi.fn();

    render(
      <svg>
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
