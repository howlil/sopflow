import { describe, expect, it } from "vitest";
import { parseSopOperation } from "../src/operation-schema.js";

describe("SopOperationSchema", () => {
  it("parses an actor operation", () => {
    const result = parseSopOperation({
      type: "add-actor",
      actor: {
        id: "reviewer",
        name: "Reviewer",
      },
    });

    expect(result).toEqual({
      success: true,
      data: {
        type: "add-actor",
        actor: {
          id: "reviewer",
          name: "Reviewer",
        },
      },
    });
  });

  it("parses a valid operation", () => {
    const result = parseSopOperation({
      type: "connect",
      from: "task",
      to: "end",
    });

    expect(result).toEqual({
      success: true,
      data: { type: "connect", from: "task", to: "end" },
    });
  });

  it("parses an insert-step operation", () => {
    const result = parseSopOperation({
      type: "insert-step",
      afterStepId: "prepare",
      step: {
        id: "collect",
        type: "task",
        name: "Collect",
        actorIds: [],
        next: "end",
      },
    });

    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({
        type: "insert-step",
        afterStepId: "prepare",
      }),
    });
  });

  it("parses an insert-step-before operation", () => {
    const result = parseSopOperation({
      type: "insert-step-before",
      beforeStepId: "end",
      step: {
        id: "archive",
        type: "task",
        name: "Archive",
        actorIds: [],
        next: "end",
      },
    });

    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({
        type: "insert-step-before",
        beforeStepId: "end",
      }),
    });
  });

  it("rejects an unknown operation type", () => {
    const result = parseSopOperation({ type: "delete-document" });

    expect(result.success).toBe(false);
  });
});
