import { describe, expect, it } from "vitest";

import * as publicApi from "./index.js";

describe("@sopflow/react public API", () => {
  it("exports only the supported runtime component", () => {
    expect(Object.keys(publicApi)).toEqual(["SopEditor"]);
    expect(publicApi.SopEditor).toBeTypeOf("function");
  });
});
