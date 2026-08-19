import type { OwnedModuleEdge } from "./module-cycle-policy";

/**
 * Exact directed edges may exist here only during an active cycle-removal slice.
 * The steady-state owned-Module graph has no accepted cycles.
 */
export const moduleCycleBaseline: ReadonlyArray<OwnedModuleEdge> = [];
