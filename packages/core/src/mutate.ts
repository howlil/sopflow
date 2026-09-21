import type { Actor, ActorId, SOPDocument, Step, StepId } from "./types.js";
import { SopCoreError } from "./errors.js";
import { getIncomingConnections, getNextStepIds } from "./graph.js";

export function addActor(document: SOPDocument, actor: Actor): SOPDocument {
  const exists = document.actors.some((item) => item.id === actor.id);

  if (exists) {
    throw new SopCoreError(
      "DUPLICATE_ACTOR_ID",
      `Actor "${actor.id}" already exists`,
      { actorId: actor.id },
    );
  }

  return {
    ...document,
    actors: [...document.actors, actor],
  };
}

export function updateActor(document: SOPDocument, actor: Actor): SOPDocument {
  const exists = document.actors.some((item) => item.id === actor.id);

  if (!exists) {
    throw new SopCoreError(
      "ACTOR_NOT_FOUND",
      `Actor "${actor.id}" does not exist`,
      { actorId: actor.id },
    );
  }

  return {
    ...document,
    actors: document.actors.map((item) =>
      item.id === actor.id ? actor : item,
    ),
  };
}

export function removeActor(
  document: SOPDocument,
  actorId: ActorId,
): SOPDocument {
  const exists = document.actors.some((actor) => actor.id === actorId);

  if (!exists) {
    throw new SopCoreError(
      "ACTOR_NOT_FOUND",
      `Actor "${actorId}" does not exist`,
      { actorId },
    );
  }

  const usedBy = document.steps.filter((step) =>
    step.actorIds.includes(actorId),
  );

  if (usedBy.length > 0) {
    throw new SopCoreError(
      "ACTOR_IN_USE",
      `Actor "${actorId}" is still used by ${usedBy
        .map((step) => `"${step.id}"`)
        .join(", ")}`,
      { actorId },
    );
  }

  return {
    ...document,
    actors: document.actors.filter((actor) => actor.id !== actorId),
  };
}

function requireStep(
  document: SOPDocument,
  stepId: StepId,
  role: "step" | "source" = "step",
): Step {
  const step = document.steps.find((item) => item.id === stepId);

  if (step) return step;

  if (role === "source") {
    throw new SopCoreError(
      "SOURCE_STEP_NOT_FOUND",
      `Source step "${stepId}" does not exist`,
      { sourceId: stepId },
    );
  }

  throw new SopCoreError("STEP_NOT_FOUND", `Step "${stepId}" does not exist`, {
    stepId,
  });
}

function requireTarget(document: SOPDocument, targetId: StepId): void {
  if (document.steps.some((step) => step.id === targetId)) return;

  throw new SopCoreError(
    "TARGET_STEP_NOT_FOUND",
    `Target step "${targetId}" does not exist`,
    { targetId },
  );
}

function requireActorReferences(document: SOPDocument, step: Step): void {
  const actorIds = new Set(document.actors.map((actor) => actor.id));
  const unknownActorId = step.actorIds.find(
    (actorId) => !actorIds.has(actorId),
  );

  if (!unknownActorId) return;

  throw new SopCoreError(
    "UNKNOWN_ACTOR_REFERENCE",
    `Step "${step.id}" references unknown actor "${unknownActorId}"`,
    { stepId: step.id, actorId: unknownActorId },
  );
}

function requireStepTargets(document: SOPDocument, step: Step): void {
  for (const targetId of getNextStepIds(step)) {
    requireTarget(document, targetId);
  }
}

function validateNewStep(document: SOPDocument, step: Step): void {
  if (document.steps.some((item) => item.id === step.id)) {
    throw new SopCoreError(
      "DUPLICATE_STEP_ID",
      `Step "${step.id}" already exists`,
      { stepId: step.id },
    );
  }

  requireActorReferences(document, step);
  requireStepTargets(document, step);
}

export function addStep(document: SOPDocument, step: Step): SOPDocument {
  validateNewStep(document, step);

  return {
    ...document,
    steps: [...document.steps, step],
  };
}

export function insertStep(
  document: SOPDocument,
  step: Step,
  afterStepId: StepId,
): SOPDocument {
  const index = document.steps.findIndex((item) => item.id === afterStepId);

  if (index === -1) {
    throw new SopCoreError(
      "STEP_NOT_FOUND",
      `Step "${afterStepId}" does not exist`,
      { stepId: afterStepId },
    );
  }

  validateNewStep(document, step);

  return {
    ...document,
    steps: [
      ...document.steps.slice(0, index + 1),
      step,
      ...document.steps.slice(index + 1),
    ],
  };
}

export function insertStepBefore(
  document: SOPDocument,
  step: Step,
  beforeStepId: StepId,
): SOPDocument {
  const index = document.steps.findIndex((item) => item.id === beforeStepId);

  if (index === -1) {
    throw new SopCoreError(
      "STEP_NOT_FOUND",
      `Step "${beforeStepId}" does not exist`,
      { stepId: beforeStepId },
    );
  }

  validateNewStep(document, step);

  return {
    ...document,
    steps: [
      ...document.steps.slice(0, index),
      step,
      ...document.steps.slice(index),
    ],
  };
}

export function updateStep(document: SOPDocument, step: Step): SOPDocument {
  requireStep(document, step.id);
  requireActorReferences(document, step);
  requireStepTargets(document, step);

  return {
    ...document,
    steps: document.steps.map((item) => (item.id === step.id ? step : item)),
  };
}

export function removeStep(document: SOPDocument, stepId: StepId): SOPDocument {
  const step = requireStep(document, stepId);

  if (step.type === "start" || step.type === "end") {
    throw new SopCoreError(
      "INVALID_STEP_CONNECTION",
      `The ${step.type} step cannot be removed`,
      { stepId },
    );
  }

  const previous = [
    ...new Set(
      getIncomingConnections(document, stepId).map(
        (connection) => connection.from,
      ),
    ),
  ];

  if (previous.length > 0) {
    throw new SopCoreError(
      "REFERENCED_STEP",
      `Step "${stepId}" is still referenced by ${previous
        .map((previousId) => `"${previousId}"`)
        .join(", ")}`,
      { stepId },
    );
  }

  return {
    ...document,
    steps: document.steps.filter((step) => step.id !== stepId),
  };
}

export function connectStep(
  document: SOPDocument,
  fromId: StepId,
  toId: StepId,
): SOPDocument {
  const source = requireStep(document, fromId, "source");
  requireTarget(document, toId);

  if (source.type !== "start" && source.type !== "task") {
    throw new SopCoreError(
      "INVALID_STEP_CONNECTION",
      `Step ${fromId} cannot use a single next connection`,
      { sourceId: fromId, targetId: toId },
    );
  }

  return {
    ...document,
    steps: document.steps.map((step) =>
      step.id === fromId
        ? {
            ...source,
            next: toId,
          }
        : step,
    ),
  };
}

export function connectDecisionBranch(
  document: SOPDocument,
  decisionId: StepId,
  branch: "yes" | "no",
  targetId: StepId,
): SOPDocument {
  const decision = requireStep(document, decisionId, "source");
  requireTarget(document, targetId);

  if (decision.type !== "decision") {
    throw new SopCoreError(
      "INVALID_STEP_CONNECTION",
      `Step ${decisionId} is not a decision`,
      { sourceId: decisionId, targetId },
    );
  }

  return {
    ...document,
    steps: document.steps.map((step) =>
      step.id === decisionId
        ? {
            ...decision,
            [branch]: targetId,
          }
        : step,
    ),
  };
}
