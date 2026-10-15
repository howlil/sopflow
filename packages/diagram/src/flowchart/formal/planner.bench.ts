import { bench, describe } from "vitest";
import {
  planFormalProcedureEdges,
  type FormalProcedureModelLike,
} from "./planner.js";
import type { FormalFlowchartGeometry } from "./types.js";

/**
 * Manual benchmark: pnpm --filter @sopflow/diagram bench:routes
 * Use repeatable graphs to compare changes to the routing implementation.
 */
function fixture(count: number) {
  const rows: FormalProcedureModelLike["rows"] = Array.from(
    { length: count },
    (_, index) => ({
      stepId: `step-${index}`,
      number: index + 1,
      kind: index === 0 ? "start" : index === count - 1 ? "end" : "task",
      primaryActorId: index % 2 === 0 ? "staff" : "manager",
    }),
  );
  const edges: FormalProcedureModelLike["edges"] = rows
    .slice(0, -1)
    .map((row, index) => ({
      id: `${row.stepId}:next:step-${index + 1}`,
      from: row.stepId,
      to: `step-${index + 1}`,
      kind: "next" as const,
    }));
  const geometry: FormalFlowchartGeometry = {
    width: 700,
    height: count * 120,
    pelaksanaBounds: { left: 100, top: 0, right: 550, bottom: count * 120 },
    columns: {
      staff: { left: 100, top: 0, right: 290, bottom: count * 120 },
      manager: { left: 320, top: 0, right: 550, bottom: count * 120 },
    },
    gridLayout: null,
    shapes: new Map(
      rows.map((row, index) => [
        row.stepId,
        {
          stepId: row.stepId,
          actorId: row.primaryActorId,
          row: index,
          kind: row.kind,
          rect: {
            left: index % 2 === 0 ? 160 : 380,
            top: index * 120 + 10,
            width: 82,
            height: 42,
          },
        },
      ]),
    ),
  };
  return { model: { rows, edges }, geometry };
}

describe("formal procedure routing scalability", () => {
  for (const count of [25, 75, 150]) {
    const { model, geometry } = fixture(count);
    bench(`${count} cross-lane steps`, () => {
      planFormalProcedureEdges(model, geometry, {}, { maxReconcilePasses: 2 });
    });
  }
});
