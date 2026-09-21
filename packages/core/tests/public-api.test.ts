import { describe, expect, it } from "vitest";
import {
  applyOperation,
  applyOperationInput,
  applyValidatedOperations,
  applyValidatedHistoryOperations,
  buildInsertTaskAfterOperations,
  createGraphIndex,
  createHistory,
  getStepRemovalOptions,
  parseSop,
  parseSopOperation,
  validateSop,
} from "../src/index.js";

describe("public API", () => {
  it("exports core APIs", () => {
    expect(parseSop).toBeTypeOf("function");
    expect(validateSop).toBeTypeOf("function");
    expect(applyOperation).toBeTypeOf("function");
    expect(applyOperationInput).toBeTypeOf("function");
    expect(applyValidatedOperations).toBeTypeOf("function");
    expect(applyValidatedHistoryOperations).toBeTypeOf("function");
    expect(parseSopOperation).toBeTypeOf("function");
    expect(createHistory).toBeTypeOf("function");
    expect(createGraphIndex).toBeTypeOf("function");
    expect(buildInsertTaskAfterOperations).toBeTypeOf("function");
    expect(getStepRemovalOptions).toBeTypeOf("function");
  });
});
