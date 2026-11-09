import type { TFunction } from "i18next";

import type { TransactionPhaseProgress } from "../../../services/transaction-workflow/transaction-workflow-model";
import type { TransactionFailure } from "./transaction-failure";

/** A step sent to the network: being broadcast or confirmed. */
const isInFlight = (phases: TransactionPhaseProgress) =>
  phases.broadcast === "active" || phases.confirm === "active";

/** What a step's failure says: its message, and whether the user declined. */
type TransactionStepFailure = Pick<TransactionFailure, "cancelled"> & {
  readonly message: string | null;
};

/** Where a step stands, and what it says under its state. */
type TransactionStepState = {
  readonly state:
    | "pending"
    | "active"
    | "signing"
    | "broadcasting"
    | "done"
    | "failed"
    | "cancelled";
  readonly message?: string;
};

/**
 * Where a transaction's sign, broadcast and confirm phases put its step, with
 * `failure`, what went wrong, once one failed: a request declined in the
 * wallet reads as cancelled, not failed. A step sent to the network that
 * `slow`ly confirms says it is taking longer than usual; one waiting for the
 * user's signature never does.
 */
export const getTransactionStepState = (
  t: TFunction,
  {
    done,
    failure,
    phases,
    slow,
  }: {
    readonly done: boolean;
    readonly failure: TransactionStepFailure | null;
    readonly phases: TransactionPhaseProgress;
    readonly slow: boolean;
  }
): TransactionStepState => {
  if (done) return { state: "done" };
  if (
    phases.sign === "failed" ||
    phases.broadcast === "failed" ||
    phases.confirm === "failed"
  ) {
    const state = failure?.cancelled ? "cancelled" : "failed";
    return failure?.message ? { message: failure.message, state } : { state };
  }
  if (phases.sign === "active") return { state: "signing" };
  const slowMessage =
    slow && isInFlight(phases) ? { message: t("steps.slow") } : {};
  if (phases.broadcast === "active") {
    return { state: "broadcasting", ...slowMessage };
  }
  if (phases.confirm === "active") return { state: "active", ...slowMessage };
  if (phases.confirm === "done") return { state: "done" };
  return { state: "pending" };
};

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
