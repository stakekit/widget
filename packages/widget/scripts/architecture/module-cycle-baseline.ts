/**
 * Allowed owned-Module cycle edges during an active cycle-removal slice.
 *
 * Used by `check-architecture.ts`. The steady-state graph has no accepted
 * cycles.
 */
import type { OwnedModuleEdge } from "./module-cycle-policy";

export const moduleCycleBaseline: ReadonlyArray<OwnedModuleEdge> = [];
