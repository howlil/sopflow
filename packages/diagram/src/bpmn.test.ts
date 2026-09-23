import type { SOPDocument } from "@sopflow/core";
import { describe, expect, it } from "vitest";
import { buildBpmnModel } from "./bpmn.js";

const document: SOPDocument = {
  schemaVersion: "1",
  id: "bpmn",
  title: "BPMN",
  actors: [
    { id: "staff", name: "Staff" },
    { id: "manager", name: "Manager" },
  ],
  steps: [
    {
      id: "start",
      type: "start",
      name: "Mulai",
      actorIds: ["staff"],
      next: "review",
    },
    {
      id: "review",
      type: "decision",
      name: "Valid?",
      actorIds: ["manager"],
      yes: "end",
      no: "fix",
    },
    {
      id: "fix",
      type: "task",
      name: "Perbaiki",
      actorIds: ["staff"],
      next: "review",
    },
    {
      id: "end",
      type: "end",
      name: "Selesai",
      actorIds: ["manager"],
    },
  ],
};

describe("buildBpmnModel", () => {
  it("lays out actor lanes and nodes from the shared workflow graph", () => {
    const model = buildBpmnModel(document);

    expect(model.lanes.map((lane) => lane.label)).toEqual(["Staff", "Manager"]);
    expect(model.nodes.find((node) => node.id === "review")).toMatchObject({
      kind: "decision",
      laneIndex: 1,
    });
    expect(model.edges.map((edge) => edge.id)).toEqual([
      "start:next:review",
      "review:yes:end",
      "review:no:fix",
      "fix:next:review",
    ]);
  });

  it("routes every renderable edge without rebuilding topology", () => {
    const model = buildBpmnModel(document);

    expect(model.edges).toHaveLength(4);
    expect(model.edges.every((edge) => edge.points.length >= 2)).toBe(true);
    expect(model.edges.find((edge) => edge.kind === "yes")?.label).toBe("Ya");
    expect(model.edges.find((edge) => edge.kind === "no")?.label).toBe("Tidak");
  });

  it("routes a self-loop around the BPMN node", () => {
    const selfLoopDocument: SOPDocument = {
      ...document,
      id: "bpmn-self-loop",
      steps: [
        document.steps[0] as SOPDocument["steps"][number],
        {
          id: "review",
          type: "decision",
          name: "Valid?",
          actorIds: ["manager"],
          yes: "review",
          no: "end",
        },
        document.steps[2] as SOPDocument["steps"][number],
        document.steps[3] as SOPDocument["steps"][number],
      ],
    };
    const model = buildBpmnModel(selfLoopDocument);
    const edge = model.edges.find(
      (candidate) => candidate.id === "review:yes:review",
    );
    const node = model.nodes.find((candidate) => candidate.id === "review");

    expect(edge).toBeDefined();
    expect(node).toBeDefined();
    if (!edge || !node) return;
    expect(edge.points.length).toBeGreaterThan(2);
    expect(Math.max(...edge.points.map((point) => point.x))).toBeGreaterThan(
      node.x + node.width / 2,
    );
    expect(Math.min(...edge.points.map((point) => point.y))).toBeLessThan(
      node.y - node.height / 2,
    );
  });

  it("keeps Ya and Tidak labels separated for a shared self-loop target", () => {
    const model = buildBpmnModel({
      ...document,
      id: "bpmn-shared-self-loop",
      steps: document.steps.map((step) =>
        step.id === "review" ? { ...step, yes: "review", no: "review" } : step,
      ),
    });
    const loops = model.edges.filter((edge) => edge.from === "review");

    expect(loops.map((edge) => edge.label)).toEqual(["Ya", "Tidak"]);
    expect(loops[0]?.labelPosition?.x).not.toBe(loops[1]?.labelPosition?.x);
  });

  it("uses an explicit fallback lane for an unassigned step", () => {
    const model = buildBpmnModel({
      ...document,
      id: "bpmn-fallback-lane",
      steps: document.steps.map((step) =>
        step.id === "review" ? { ...step, actorIds: [] } : step,
      ),
    });

    expect(model.lanes.at(-1)?.label).toBe("Pelaksana");
    expect(model.nodes.find((node) => node.id === "review")?.laneIndex).toBe(2);
    expect(model.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "UNASSIGNED_ACTOR",
        from: "review",
      }),
    );
  });

  it("preserves projection diagnostics when an edge target is missing", () => {
    const model = buildBpmnModel({
      ...document,
      id: "bpmn-missing-target",
      steps: document.steps.map((step) =>
        step.id === "start" ? { ...step, next: "missing" } : step,
      ),
    });

    expect(model.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "MISSING_EDGE_TARGET",
        edgeId: "start:next:missing",
      }),
    );
  });

  it("grows task geometry and lane footprint for long labels", () => {
    const longLabel =
      "Verifikasi dokumen pengajuan pembayaran dan kelengkapan administrasi secara menyeluruh";
    const model = buildBpmnModel({
      ...document,
      id: "bpmn-long-label",
      steps: document.steps.map((step) =>
        step.id === "fix" ? { ...step, name: longLabel } : step,
      ),
    });
    const node = model.nodes.find((candidate) => candidate.id === "fix");
    const lane = model.lanes.find(
      (candidate) => candidate.index === node?.laneIndex,
    );

    expect(node).toBeDefined();
    expect(node?.labelLines.length).toBeGreaterThan(1);
    expect(node?.width).toBeGreaterThan(96);
    expect(node?.height).toBeGreaterThanOrEqual(48);
    expect(lane?.height).toBeGreaterThanOrEqual(model.laneHeight);
  });

  it("keeps adjacent BPMN node footprints separated after dynamic sizing", () => {
    const model = buildBpmnModel({
      schemaVersion: "1",
      id: "bpmn-wide-chain",
      title: "Wide chain",
      actors: [{ id: "staff", name: "Staff" }],
      steps: [
        {
          id: "start",
          type: "start",
          name: "Mulai",
          actorIds: ["staff"],
          next: "first",
        },
        {
          id: "first",
          type: "task",
          name: "Verifikasi dokumen permohonan yang sangat panjang",
          actorIds: ["staff"],
          next: "second",
        },
        {
          id: "second",
          type: "task",
          name: "Lakukan validasi lanjutan untuk seluruh lampiran",
          actorIds: ["staff"],
          next: "end",
        },
        {
          id: "end",
          type: "end",
          name: "Selesai",
          actorIds: ["staff"],
        },
      ],
    });
    const first = model.nodes.find((node) => node.id === "first");
    const second = model.nodes.find((node) => node.id === "second");

    if (!first || !second) throw new Error("BPMN task nodes not found");

    const firstRight = first.x + first.width / 2;
    const secondLeft = second.x - second.width / 2;
    expect(secondLeft).toBeGreaterThan(firstRight);
  });

  it("keeps BPMN layout stable when step storage order changes", () => {
    const original = buildBpmnModel(document);
    const shuffled = buildBpmnModel({
      ...document,
      steps: [...document.steps].reverse(),
    });

    expect(shuffled).toEqual(original);
  });
});
