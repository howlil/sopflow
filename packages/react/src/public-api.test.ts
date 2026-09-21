import { describe, expect, it } from "vitest";

import * as publicApi from "./index.js";

describe("@sopflow/react public API", () => {
  it("exports the supported editor composition and reusable primitives", () => {
    expect(Object.keys(publicApi).sort()).toEqual(
      [
        "ActorsEditor",
        "SopDiagram",
        "SopEditor",
        "SopHeaderFields",
        "SopHeaderView",
        "SopWorkspace",
      ].sort(),
    );
    expect(publicApi.ActorsEditor).toBeTypeOf("function");
    expect(publicApi.SopDiagram).toBeTypeOf("function");
    expect(publicApi.SopEditor).toBeTypeOf("function");
    expect(publicApi.SopHeaderFields).toBeTypeOf("function");
    expect(publicApi.SopHeaderView).toBeTypeOf("function");
    expect(publicApi.SopWorkspace).toBeTypeOf("function");
  });
});
