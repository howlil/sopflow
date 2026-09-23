import { describe, expect, it } from "vitest";
import {
  classifyFormalFlowchartRouteComplexity,
  formalRowSpan,
  isSimpleSequentialFormalFlow,
} from "./complexity.js";

describe("formal flowchart route complexity parity", () => {
  it("keeps adjacent non-decision downward flow simple", () => {
    const input = {
      fromRow: 1,
      toRow: 2,
      sameColumn: true,
      crossColumn: false,
      kind: "next" as const,
      sourceType: "flowchart-process" as const,
      targetType: "flowchart-process" as const,
    };

    expect(isSimpleSequentialFormalFlow(input)).toBe(true);
    expect(classifyFormalFlowchartRouteComplexity(input)).toBe("simple");
  });

  it("treats decision loopback as complex", () => {
    expect(
      classifyFormalFlowchartRouteComplexity({
        fromRow: 4,
        toRow: 1,
        sameColumn: true,
        crossColumn: false,
        kind: "no",
        sourceType: "flowchart-decision",
        targetType: "flowchart-process",
      }),
    ).toBe("complex");
  });

  it("treats long cross-column routing as complex", () => {
    expect(
      classifyFormalFlowchartRouteComplexity({
        fromRow: 1,
        toRow: 4,
        sameColumn: false,
        crossColumn: true,
        kind: "next",
        sourceType: "flowchart-process",
        targetType: "flowchart-process",
      }),
    ).toBe("complex");
  });

  it("computes row span from authoring rows", () => {
    expect(formalRowSpan({ fromRow: 2, toRow: 6 })).toBe(4);
    expect(formalRowSpan({ fromRow: 6, toRow: 2 })).toBe(4);
  });
});
