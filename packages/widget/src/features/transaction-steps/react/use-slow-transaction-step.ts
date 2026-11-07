import { useAtomValue } from "@effect/atom-react";

import type { TransactionPhaseProgress } from "../../../services/transaction-workflow/transaction-workflow-model";
import { getInFlightTransactionStepId } from "../model/transaction-step";
import { slowTransactionStepAtom } from "../state/slow-transaction-step";

/** See `slowTransactionStepAtom`. */
export const useSlowTransactionStep = (
  steps: ReadonlyArray<{
    readonly done: boolean;
    readonly id: string;
    readonly phases: TransactionPhaseProgress;
  }>
): string | null =>
  useAtomValue(slowTransactionStepAtom(getInFlightTransactionStepId(steps)));
