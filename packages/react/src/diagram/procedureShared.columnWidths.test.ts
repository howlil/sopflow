import { describe, expect, it } from "vitest";
import { procedureColumnWidths } from "./procedureShared.js";

describe("procedure column widths", () => {
  it.each([1, 2, 3, 4, 8, 12])(
    "allocates exactly 100 percent across %i actor columns",
    (actorCount) => {
      const widths = procedureColumnWidths(actorCount);
      const fixed = [
        widths.number,
        widths.activity,
        widths.input,
        widths.duration,
        widths.output,
        widths.note,
      ].reduce((sum, value) => sum + Number.parseFloat(value), 0);
      const total = fixed + Number.parseFloat(widths.actor) * actorCount;
      expect(total).toBeCloseTo(100, 8);
    },
  );
});
