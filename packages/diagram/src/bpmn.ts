/** Stable public entry; BPMN responsibilities live under bpmn/. */
export { buildBpmnModel } from "./bpmn/model.js";
export type {
  BpmnLayoutOptions,
  BpmnLane,
  BpmnNode,
  BpmnRoutedEdge,
  BpmnModel,
} from "./bpmn/types.js";
