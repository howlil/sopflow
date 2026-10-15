/**
 * Deterministic geometry benchmark. Run from workspace with
 * pnpm --filter @sopflow/diagram bench:routes
 * Compare p50/p95 under identical Node versions and hardware.
 */
import { performance } from "node:perf_hooks";
import { planFormalProcedureEdges } from "../packages/diagram/dist/index.mjs";

function fixture(count) {
  const rows = Array.from({ length: count }, (_, index) => ({
    stepId: `step-${index}`,
    number: index + 1,
    kind: index === 0 ? "start" : index === count - 1 ? "end" : "task",
    primaryActorId: index % 2 === 0 ? "staff" : "manager",
  }));
  const edges = rows.slice(0, -1).map((row, index) => ({
    id: `${row.stepId}:next:step-${index + 1}`,
    from: row.stepId,
    to: `step-${index + 1}`,
    kind: "next",
  }));
  const geometry = {
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

for (const count of [25, 75, 150]) {
  const { model, geometry } = fixture(count);
  const samples = [];
  // Warm-up is excluded from measured samples.
  planFormalProcedureEdges(model, geometry, {}, { maxReconcilePasses: 2 });
  for (let sample = 0; sample < 7; sample += 1) {
    const start = performance.now();
    const routed = planFormalProcedureEdges(
      model,
      geometry,
      {},
      { maxReconcilePasses: 2 },
    );
    samples.push(performance.now() - start);
    if (routed.length !== count - 1) {
      throw new Error(`Expected ${count - 1} edges, got ${routed.length}`);
    }
  }
  samples.sort((a, b) => a - b);
  const p50 = samples[Math.floor(samples.length * 0.5)];
  const p95 = samples[Math.ceil(samples.length * 0.95) - 1];
  console.log(
    `${count} cross-lane steps: p50=${p50.toFixed(2)}ms p95=${p95.toFixed(2)}ms`,
  );
}
