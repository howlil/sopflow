import type { DiagramPoint, DiagramSide } from "../types.js";

export type ProcedureManualRoute =
  | {
      readonly kind: "trunk";
      readonly x: number;
      readonly labelPosition?: DiagramPoint;
      readonly sSide?: DiagramSide;
      readonly eSide?: DiagramSide;
      /** Stable normalized anchor position on the selected source side. */
      readonly sourceDistance?: number;
      /** Stable normalized anchor position on the selected target side. */
      readonly targetDistance?: number;
      /** @deprecated Migration fallback for configs persisted before semantic anchors. */
      readonly startPoint?: DiagramPoint;
      /** @deprecated Migration fallback for configs persisted before semantic anchors. */
      readonly endPoint?: DiagramPoint;
    }
  | {
      readonly kind: "orthogonal";
      readonly bendPoints: readonly DiagramPoint[];
      readonly labelPosition?: DiagramPoint;
      readonly sSide?: DiagramSide;
      readonly eSide?: DiagramSide;
      /** Stable normalized anchor position on the selected source side. */
      readonly sourceDistance?: number;
      /** Stable normalized anchor position on the selected target side. */
      readonly targetDistance?: number;
      /** @deprecated Migration fallback for configs persisted before semantic anchors. */
      readonly startPoint?: DiagramPoint;
      /** @deprecated Migration fallback for configs persisted before semantic anchors. */
      readonly endPoint?: DiagramPoint;
    };

export type ProcedureManualRoutes = Readonly<
  Record<string, ProcedureManualRoute>
>;

export interface ProcedurePagedRouteOverride {
  readonly source?: ProcedureManualRoute;
  readonly target?: ProcedureManualRoute;
}

export type ProcedurePagedRouteOverrides = Readonly<
  Record<string, ProcedurePagedRouteOverride>
>;

export interface SopDiagramConfig {
  readonly routes?: ProcedureManualRoutes;
  /**
   * Manual route segments created when one semantic edge crosses a page
   * boundary. Keys are canonical WorkflowEdge ids, never renderer __out/__in
   * ids.
   */
  readonly pagedRoutes?: ProcedurePagedRouteOverrides;
  /**
   * Deterministic routing seed. Different seeds try another stable connection
   * order without changing SOP semantics.
   */
  readonly pathLayoutSeed?: number;
}

/**
 * @deprecated Use SopDiagramConfig.routes. Kept so existing low-level
 * SopProcedureView consumers can migrate without a breaking change.
 */
export type ProcedureManualTrunks = Readonly<Record<string, number>>;

export type ProcedureRoutingOverrides =
  | SopDiagramConfig
  | ProcedureManualTrunks;
