import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Cause, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type { Action } from "../core";
import {
  BorrowExecutionKey,
  type BorrowExecutionMachineState,
  type BorrowExecutionPhase,
  type BorrowExecutionResult,
  type BorrowExecutionStep,
  type BorrowSubmittedTransaction,
  type BorrowTransactionExecutionError,
  borrowExecutionAtom,
  getBorrowExecutionAction,
  getBorrowExecutionPhase,
  getBorrowExecutionResult,
  getBorrowExecutionSteps,
  getBorrowExecutionSubmissions,
  isBorrowExecutionDone,
  isBorrowTransactionExecutionError,
} from "../core";

type BorrowExecutionState = {
  readonly action: Action | null;
  readonly completionResult: BorrowExecutionResult | null;
  readonly currentTransaction: Action["transactions"][number] | null;
  readonly currentTransactionIndex: number | null;
  readonly error: BorrowTransactionExecutionError | null;
  readonly isDone: boolean;
  readonly isRunning: boolean;
  readonly phase: BorrowExecutionPhase;
  readonly result: AsyncResult.AsyncResult<
    BorrowExecutionMachineState,
    unknown
  >;
  readonly retry: () => void;
  readonly steps: ReadonlyArray<BorrowExecutionStep>;
  readonly submissions: ReadonlyArray<BorrowSubmittedTransaction>;
};

const getExecutionError = (
  result: AsyncResult.AsyncResult<BorrowExecutionMachineState, unknown>
) => {
  if (!AsyncResult.isFailure(result)) {
    return null;
  }

  const error = Cause.findErrorOption(result.cause);

  if (Option.isNone(error)) {
    return null;
  }

  return isBorrowTransactionExecutionError(error.value) ? error.value : null;
};

export const useBorrowExecution = ({
  action,
}: {
  readonly action: Action;
}): BorrowExecutionState => {
  const executionAtom = borrowExecutionAtom(
    new BorrowExecutionKey({
      action,
    })
  );
  const result = useAtomValue(executionAtom);
  const retry = useAtomRefresh(executionAtom);
  const stateOption = AsyncResult.value(result);
  const state = Option.isSome(stateOption) ? stateOption.value : null;
  const error = AsyncResult.isWaiting(result)
    ? null
    : getExecutionError(result);
  const phase = error?.phase ?? getBorrowExecutionPhase(state);
  const isDone = isBorrowExecutionDone(state);

  return {
    action: getBorrowExecutionAction(state),
    completionResult: state && isDone ? getBorrowExecutionResult(state) : null,
    currentTransaction: state?.transactions[state.currentTxIndex] ?? null,
    currentTransactionIndex: state?.currentTxIndex ?? null,
    error,
    isDone,
    isRunning: AsyncResult.isWaiting(result) || (!error && !isDone),
    phase,
    result,
    retry,
    steps: getBorrowExecutionSteps({
      error,
      phase,
    }),
    submissions: getBorrowExecutionSubmissions(state),
  };
};
