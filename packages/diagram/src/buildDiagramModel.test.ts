import { describe, expect, it } from "vitest";

import type { SOPDocument } from "@sopflow/core";

import { buildDiagramModel } from "./buildDiagramModel.js";

const document: SOPDocument = {
  schemaVersion: "1",
  id: "test",
  title: "Test",
  actors: [],
  steps: [
    {
      id: "start",
      type: "start",
      name: "Mulai",
      actorIds: [],
      next: "review",
    },
    {
      id: "review",
      type: "decision",
      name: "Valid?",
      actorIds: [],
      yes: "end",
      no: "fix",
    },
    {
      id: "fix",
      type: "task",
      name: "Perbaiki",
      actorIds: [],
      next: "review",
    },
    {
      id: "end",
      type: "end",
      name: "Selesai",
      actorIds: [],
    },
  ],
};

describe("buildDiagramModel", () => {
  it("creates one node per SOP step", () => {
    const model = buildDiagramModel(document);

    expect(model.nodes).toHaveLength(4);
    expect(model.nodes.map((node) => node.id)).toEqual([
      "start",
      "review",
      "fix",
      "end",
    ]);
  });

  it("creates explicit workflow edges", () => {
    const model = buildDiagramModel(document);

    expect(model.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: "start",
          to: "review",
          kind: "next",
        }),
        expect.objectContaining({
          from: "review",
          to: "end",
          kind: "yes",
          label: "Ya",
        }),
        expect.objectContaining({
          from: "review",
          to: "fix",
          kind: "no",
          label: "Tidak",
        }),
        expect.objectContaining({
          from: "fix",
          to: "review",
          kind: "next",
        }),
      ]),
    );
  });

  it("keeps cycle edges without inferring step order", () => {
    const model = buildDiagramModel(document);

    expect(model.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: "fix",
          to: "review",
        }),
      ]),
    );

    expect(model.edges).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: "review",
          to: "fix",
          kind: "next",
        }),
      ]),
    );
  });

  it("preserves explicit references even when validation has not run", () => {
    const invalidDocument: SOPDocument = {
      ...document,
      steps: [
        {
          id: "start",
          type: "start",
          name: "Mulai",
          actorIds: [],
          next: "missing",
        },
      ],
    };

    const model = buildDiagramModel(invalidDocument);

    expect(model.edges).toEqual([
      {
        id: "start:next:missing",
        from: "start",
        to: "missing",
        kind: "next",
      },
    ]);
  });
});
