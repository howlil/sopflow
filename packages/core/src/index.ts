export {
  canReachEnd,
  createGraphIndex,
  findCycleStepIds,
  findDeadEndStepIds,
  getIncomingConnections,
  getNextStepIds,
  getOrderedStepIds,
  getOrderedSteps,
  getPresentationStepIds,
  getPresentationSteps,
  getPreviousConnections,
  getPreviousStepIds,
  getReachableStepIds,
  getStep,
} from "./graph.js";
export type { IncomingConnection, SopGraphIndex } from "./graph.js";

export { parseSop } from "./parse.js";
export type {
  ParseSOPFailure,
  ParseSOPIssue,
  ParseSOPResult,
  ParseSOPSuccess,
} from "./parse.js";

export {
  ActorSchema,
  DecisionStepSchema,
  DurationSchema,
  EndStepSchema,
  SOPDocumentSchema,
  StartStepSchema,
  StepSchema,
  TaskStepSchema,
} from "./schema.js";

export type {
  Actor,
  ActorId,
  DecisionStep,
  Duration,
  EndStep,
  SOPDocument,
  StartStep,
  Step,
  StepBase,
  StepId,
  TaskStep,
} from "./types.js";

export {
  validateActorReference,
  validateDecisionBranches,
  validateEndReachability,
  validateEndReachbilty,
  validateReachability,
  validateReference,
  validateSop,
  validateUniqueActorIds,
  validateUniqueStepIds,
} from "./validate.js";
export type { ValidationIssue, ValidationIssueCode } from "./validate.js";

export {
  addActor,
  addStep,
  connectDecisionBranch,
  connectStep,
  insertStep,
  insertStepBefore,
  removeActor,
  removeStep,
  updateActor,
  updateStep,
} from "./mutate.js";

export {
  applyOperation,
  applyOperationInput,
  applyOperations,
  applyValidatedOperations,
} from "./operations.js";
export type { SopOperation } from "./operations.js";

export {
  applyHistoryOperation,
  applyHistoryOperations,
  applyValidatedHistoryOperations,
  createHistory,
  redo,
  undo,
} from "./history.js";
export type { SopHistory } from "./history.js";

export {
  invalidDocumentError,
  isSopCoreError,
  SopCoreError,
} from "./errors.js";
export type { CoreErrorCode, CoreErrorDetails } from "./errors.js";

export {
  parseSopOperation,
  SopOperationSchema,
} from "./operation-schema.js";
export type {
  ParseOperationFailure,
  ParseOperationIssue,
  ParseOperationResult,
  ParseOperationSuccess,
} from "./operation-schema.js";

export {
  buildChangeStepTypeOperations,
  buildCreateInitialWorkflowOperations,
  buildInsertTaskAfterOperations,
  buildInsertTaskBeforeEndOperations,
  buildRemoveActorAndReferencesOperations,
  buildRemoveStepAndReconnectOperations,
  buildSetDecisionBranchesOperations,
  getStepRemovalOptions,
} from "./commands.js";
export type {
  InitialWorkflowIds,
  StepRemovalOptions,
} from "./commands.js";
