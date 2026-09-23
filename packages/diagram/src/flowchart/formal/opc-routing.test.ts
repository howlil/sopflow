import { describe, expect, it } from "vitest";
import { planFormalProcedureEdges } from "./planner.js";
import type { FormalFlowchartGeometry } from "./types.js";

describe("formal OPC routing", () => {
  it("routes an OPC endpoint to a real procedure shape", () => {
    const geometry: FormalFlowchartGeometry = {
      width: 600,
      height: 360,
      pelaksanaBounds: { left: 200, top: 40, right: 400, bottom: 320 },
      columns: {
        staff: { left: 200, top: 40, right: 400, bottom: 320 },
      },
      gridLayout: null,
      shapes: new Map([
        [
          "opc-in-a-to-b",
          {
            stepId: "opc-in-a-to-b",
            actorId: "staff",
            row: -1,
            kind: "opc",
            rect: { left: 270, top: 48, width: 50, height: 40 },
          },
        ],
        [
          "step-b",
          {
            stepId: "step-b",
            actorId: "staff",
            row: 0,
            kind: "task",
            rect: { left: 254, top: 150, width: 82, height: 42 },
          },
        ],
      ]),
    };

    const [edge] = planFormalProcedureEdges(
      {
        rows: [
          {
            stepId: "opc-in-a-to-b",
            number: 0,
            kind: "opc",
            primaryActorId: "staff",
          },
          {
            stepId: "step-b",
            number: 1,
            kind: "task",
            primaryActorId: "staff",
          },
        ],
        edges: [
          {
            id: "a:next:b__in",
            from: "opc-in-a-to-b",
            to: "step-b",
            kind: "next",
          },
        ],
      },
      geometry,
    );

    expect(edge).toBeDefined();
    expect(edge?.points.length).toBeGreaterThanOrEqual(2);
    expect(edge?.points[0]?.y).toBeGreaterThanOrEqual(48);
    expect(edge?.points.at(-1)?.y).toBeLessThanOrEqual(192);
  });
});
