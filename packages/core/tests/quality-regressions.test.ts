import { describe, expect, it } from "vitest";

import { exampleSop } from "./fixtures/exampleSop.js";
import { SopCoreError } from "../src/errors.js";
import { removeActor } from "../src/mutate.js";
import { applyOperations } from "../src/operations.js";
import { parseSop } from "../src/parse.js";
import type { SOPDocument, SopOperation } from "../src/index.js";
import { validateSop } from "../src/validate.js";

describe("quality regressions", () => {
  it("rejects deleting an actor that does not exist", () => {
    try {
      removeActor(exampleSop, "missing");
      throw new Error("Expected removeActor to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(SopCoreError);
      expect((error as SopCoreError).code).toBe("ACTOR_NOT_FOUND");
    }
  });

  it("accepts readonly operation batches", () => {
    const operations = [
      {
        type: "update-actor",
        actor: { id: "staff", name: "Updated Staff" },
      },
    ] as const satisfies readonly SopOperation[];

    const result = applyOperations(exampleSop, operations);

    expect(result.actors.find((actor) => actor.id === "staff")?.name).toBe(
      "Updated Staff",
    );
  });

  it("preserves structured schema diagnostics", () => {
    const result = parseSop({
      schemaVersion: "1",
      id: "invalid",
      title: "",
      actors: [],
      steps: [],
    });

    expect(result.success).toBe(false);

    if (result.success) {
      throw new Error("Expected parse failure");
    }

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        source: "schema",
        path: ["title"],
      }),
    );
  });

  it("validates a large linear graph without per-node graph rescans", () => {
    const taskCount = 1_000;
    const steps: SOPDocument["steps"] = [
      {
        id: "start",
        type: "start",
        name: "Start",
        actorIds: [],
        next: "task-0",
      },
      ...Array.from({ length: taskCount }, (_, index) => ({
        id: `task-${index}`,
        type: "task" as const,
        name: `Task ${index}`,
        actorIds: [],
        next: index === taskCount - 1 ? "end" : `task-${index + 1}`,
      })),
      {
        id: "end",
        type: "end",
        name: "End",
        actorIds: [],
      },
    ];

    const document: SOPDocument = {
      schemaVersion: "1",
      id: "large-linear",
      title: "Large linear SOP",
      actors: [],
      steps,
    };

    expect(validateSop(document)).toEqual([]);
  });
});
