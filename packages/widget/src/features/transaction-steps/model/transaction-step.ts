import type { TransactionPhaseProgress } from "../../../services/transaction-workflow/transaction-workflow-model";

/** A step sent to the network: being broadcast or confirmed. */
export const isInFlight = (phases: TransactionPhaseProgress) =>
  phases.broadcast === "active" || phases.confirm === "active";

/**
 * The id of the step sent to the network and not yet confirmed, else null:
 * none while a step waits for its signature.
 */
export const getInFlightTransactionStepId = (
  steps: ReadonlyArray<{
    readonly done: boolean;
    readonly id: string;
    readonly phases: TransactionPhaseProgress;
  }>
): string | null =>
  steps.find((step) => !step.done && isInFlight(step.phases))?.id ?? null;
