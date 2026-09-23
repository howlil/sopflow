import { describe, expect, it } from "vitest";

import * as publicApi from "./index.js";

describe("@sopflow/react public API", () => {
  it("exports the supported editor composition and reusable primitives", () => {
    expect(Object.keys(publicApi).sort()).toEqual(
      [
        "ActorsEditor",
        "Button",
        "Dialog",
        "FormField",
        "InspectorSection",
        "Select",
        "SopBpmn",
        "SopDiagram",
        "SopEditor",
        "SopFlowchart",
        "SopHeaderFields",
        "SopHeaderView",
        "SopProcedureView",
        "SopStepFields",
        "SopWorkspace",
        "ValidationPanel",
        "getSopReadinessIssues",
        "isSopReady",
        "validateSopHeader",
      ].sort(),
    );
    expect(publicApi.ActorsEditor).toBeTypeOf("function");
    expect(publicApi.Button).toBeTypeOf("function");
    expect(publicApi.Dialog).toBeTypeOf("function");
    expect(publicApi.FormField).toBeTypeOf("function");
    expect(publicApi.InspectorSection).toBeTypeOf("function");
    expect(publicApi.Select).toBeTypeOf("function");
    expect(publicApi.SopBpmn).toBeTypeOf("function");
    expect(publicApi.SopDiagram).toBeTypeOf("function");
    expect(publicApi.SopEditor).toBeTypeOf("function");
    expect(publicApi.SopFlowchart).toBeTypeOf("function");
    expect(publicApi.SopHeaderFields).toBeTypeOf("function");
    expect(publicApi.SopHeaderView).toBeTypeOf("function");
    expect(publicApi.SopProcedureView).toBeTypeOf("function");
    expect(publicApi.SopStepFields).toBeTypeOf("function");
    expect(publicApi.SopWorkspace).toBeTypeOf("function");
    expect(publicApi.ValidationPanel).toBeTypeOf("function");
    expect(publicApi.getSopReadinessIssues).toBeTypeOf("function");
    expect(publicApi.isSopReady).toBeTypeOf("function");
    expect(publicApi.validateSopHeader).toBeTypeOf("function");
  });
});
