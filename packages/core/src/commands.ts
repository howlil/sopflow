import type { ActorId, SOPDocument, Step, StepId } from "./types.js";
import { SopCoreError } from "./errors.js";
import { getIncomingConnections, getPresentationSteps } from "./graph.js";
import { applyValidatedOperations, type SopOperation } from "./operations.js";

function requireStep(document: SOPDocument, stepId: StepId): Step {
  const step = document.steps.find((candidate) => candidate.id === stepId);

  if (!step) {
    throw new SopCoreError(
      "STEP_NOT_FOUND",
      `Step "${stepId}" does not exist`,
      {
        stepId,
      },
    );
  }

  return step;
}

function defaultActorIds(document: SOPDocument): readonly ActorId[] {
  const actor = document.actors[0];
  return actor ? [actor.id] : [];
}

export interface InitialWorkflowIds {
  readonly startId: StepId;
  readonly taskId: StepId;
  readonly endId: StepId;
}

export function buildCreateInitialWorkflowOperations(
  document: SOPDocument,
  ids: InitialWorkflowIds,
): SopOperation[] {
  if (document.steps.length > 0) {
    throw new SopCoreError(
      "INVALID_OPERATION",
      "Initial workflow can only be created for an empty SOP document",
    );
  }

  const actorIds = defaultActorIds(document);

  return [
    {
      type: "add-step",
      step: {
        id: ids.endId,
        type: "end",
        name: "Selesai",
        actorIds,
      },
    },
    {
      type: "insert-step-before",
      beforeStepId: ids.endId,
      step: {
        id: ids.taskId,
        type: "task",
        name: "",
        actorIds,
        next: ids.endId,
      },
    },
    {
      type: "insert-step-before",
      beforeStepId: ids.taskId,
      step: {
        id: ids.startId,
        type: "start",
        name: "Mulai",
        actorIds,
        next: ids.taskId,
      },
    },
  ];
}

export function buildInsertTaskAfterOperations(
  document: SOPDocument,
  afterStepId: StepId,
  taskId: StepId,
): SopOperation[] {
  const source = requireStep(document, afterStepId);

  if (source.type !== "start" && source.type !== "task") {
    throw new SopCoreError(
      "INVALID_STEP_CONNECTION",
      `Step "${afterStepId}" cannot use a single next connection`,
      { stepId: afterStepId },
    );
  }

  return [
    {
      type: "insert-step",
      afterStepId,
      step: {
        id: taskId,
        type: "task",
        name: "",
        actorIds: defaultActorIds(document),
        next: source.next,
      },
    },
    {
      type: "connect",
      from: afterStepId,
      to: taskId,
    },
  ];
}

export function buildInsertTaskBeforeEndOperations(
  document: SOPDocument,
  taskId: StepId,
): SopOperation[] {
  const ends = document.steps.filter((step) => step.type === "end");

  if (ends.length !== 1 || !ends[0]) {
    throw new SopCoreError(
      "INVALID_OPERATION",
      "Insert before end requires exactly one end step",
    );
  }

  const end = ends[0];
  const operations: SopOperation[] = [
    {
      type: "insert-step-before",
      beforeStepId: end.id,
      step: {
        id: taskId,
        type: "task",
        name: "",
        actorIds: defaultActorIds(document),
        next: end.id,
      },
    },
  ];

  for (const incoming of getIncomingConnections(document, end.id)) {
    operations.push(
      incoming.type === "next"
        ? {
            type: "connect",
            from: incoming.from,
            to: taskId,
          }
        : {
            type: "connect-decision",
            from: incoming.from,
            branch: incoming.type,
            to: taskId,
          },
    );
  }

  return operations;
}

export function buildChangeStepTypeOperations(
  document: SOPDocument,
  stepId: StepId,
  type: "task" | "decision",
): SopOperation[] {
  const step = requireStep(document, stepId);

  if (step.type === "start" || step.type === "end" || step.type === type) {
    return [];
  }

  const { id, name, actorIds, input, duration, output, note } = step;

  if (step.type === "task" && type === "decision") {
    return [
      {
        type: "update-step",
        step: {
          id,
          type: "decision",
          name,
          actorIds,
          input,
          duration,
          output,
          note,
          yes: step.next,
          no: step.next,
        },
      },
    ];
  }

  if (step.type === "decision" && type === "task") {
    if (step.yes !== step.no) {
      return [];
    }

    return [
      {
        type: "update-step",
        step: {
          id,
          type: "task",
          name,
          actorIds,
          input,
          duration,
          output,
          note,
          next: step.yes,
        },
      },
    ];
  }

  return [];
}

export function buildSetDecisionBranchesOperations(
  document: SOPDocument,
  decisionId: StepId,
  yesId: StepId,
  noId: StepId,
): SopOperation[] {
  const step = requireStep(document, decisionId);

  if (step.type !== "decision") {
    throw new SopCoreError(
      "INVALID_STEP_CONNECTION",
      `Step "${decisionId}" is not a decision`,
      { stepId: decisionId },
    );
  }

  return [
    {
      type: "connect-decision",
      from: decisionId,
      branch: "yes",
      to: yesId,
    },
    {
      type: "connect-decision",
      from: decisionId,
      branch: "no",
      to: noId,
    },
  ];
}

export interface StepRemovalOptions {
  readonly requiresReplacement: boolean;
  readonly candidates: readonly Step[];
}

export function getStepRemovalOptions(
  document: SOPDocument,
  stepId: StepId,
): StepRemovalOptions {
  const step = requireStep(document, stepId);

  if (step.type === "start" || step.type === "end") {
    return { requiresReplacement: false, candidates: [] };
  }

  const requiresReplacement =
    getIncomingConnections(document, stepId).length > 0;

  if (!requiresReplacement) {
    return { requiresReplacement: false, candidates: [] };
  }

  const candidates = getPresentationSteps(document).filter((candidate) => {
    if (candidate.id === stepId) return false;

    try {
      applyValidatedOperations(
        document,
        buildRemoveStepAndReconnectOperations(document, stepId, candidate.id, {
          validate: false,
        }),
      );
      return true;
    } catch {
      return false;
    }
  });

  return { requiresReplacement, candidates };
}

interface RemoveStepCommandOptions {
  readonly validate?: boolean;
}

export function buildRemoveStepAndReconnectOperations(
  document: SOPDocument,
  stepId: StepId,
  replacementId?: StepId,
  options: RemoveStepCommandOptions = {},
): SopOperation[] {
  const step = requireStep(document, stepId);

  if (step.type === "start" || step.type === "end") {
    throw new SopCoreError(
      "INVALID_STEP_CONNECTION",
      `The ${step.type} step cannot be removed`,
      { stepId },
    );
  }

  const incoming = getIncomingConnections(document, stepId);

  if (incoming.length > 0 && !replacementId) {
    throw new SopCoreError(
      "REFERENCED_STEP",
      `Step "${stepId}" requires a replacement target before removal`,
      { stepId },
    );
  }

  if (replacementId === stepId) {
    throw new SopCoreError(
      "INVALID_STEP_CONNECTION",
      "A step cannot reconnect to itself while being removed",
      { stepId, targetId: replacementId },
    );
  }

  const operations: SopOperation[] = [];

  if (replacementId) {
    for (const connection of incoming) {
      operations.push(
        connection.type === "next"
          ? {
              type: "connect",
              from: connection.from,
              to: replacementId,
            }
          : {
              type: "connect-decision",
              from: connection.from,
              branch: connection.type,
              to: replacementId,
            },
      );
    }
  }

  operations.push({ type: "remove-step", stepId });

  if (options.validate !== false) {
    applyValidatedOperations(document, operations);
  }

  return operations;
}

export function buildRemoveActorAndReferencesOperations(
  document: SOPDocument,
  actorId: ActorId,
): SopOperation[] {
  const exists = document.actors.some((actor) => actor.id === actorId);

  if (!exists) {
    throw new SopCoreError(
      "ACTOR_NOT_FOUND",
      `Actor "${actorId}" does not exist`,
      { actorId },
    );
  }

  const operations: SopOperation[] = document.steps
    .filter((step) => step.actorIds.includes(actorId))
    .map((step) => ({
      type: "update-step",
      step: {
        ...step,
        actorIds: step.actorIds.filter(
          (candidateId) => candidateId !== actorId,
        ),
      },
    }));

  operations.push({ type: "remove-actor", actorId });
  return operations;
}
