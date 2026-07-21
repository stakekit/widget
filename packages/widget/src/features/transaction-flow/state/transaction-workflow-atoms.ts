import { Effect, Option, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { walletRuntime } from "../../../app/runtime/wallet-runtime";
import type { YieldAction } from "../../../domain/schema/action-models";
import type { TransactionType } from "../../../domain/types/action";
import type {
  ClassicTransactionWorkflowKey,
  TransactionWorkflowCommand,
  TransactionWorkflowKey,
  TransactionWorkflowState,
  TransactionWorkflowTransactionMeta,
} from "../../../services/workflow/transaction-workflow-model";
import {
  flattenTransactionWorkflowTransactions,
  getCurrentTransactionWorkflowTransaction,
  getTransactionWorkflowId,
  initializeTransactionWorkflow,
} from "../../../services/workflow/transaction-workflow-model";
import { TransactionWorkflowService } from "../../../services/workflow/transaction-workflow-service";
import {
  actionHistoryTimestampAtom,
  markActionHistoryChanged,
} from "./action-history";

export enum ClassicTransactionStepState {
  SIGN_IDLE = 0,
  SIGN_ERROR = 1,
  SIGN_LOADING = 2,
  SIGN_SUCCESS = 3,
  BROADCAST_ERROR = 5,
  BROADCAST_LOADING = 6,
  BROADCAST_SUCCESS = 7,
  CHECK_TX_STATUS_ERROR = 9,
  CHECK_TX_STATUS_LOADING = 10,
  CHECK_TX_STATUS_SUCCESS = 11,
}

type ClassicTransactionState = {
  readonly meta: TransactionWorkflowTransactionMeta;
  readonly tx: YieldAction["transactions"][number];
};

const getClassicTransactionStepState = ({
  currentTxId,
  machineState,
  txState,
}: {
  readonly currentTxId: string | null;
  readonly machineState: TransactionWorkflowState;
  readonly txState: ClassicTransactionState;
}): ClassicTransactionStepState => {
  if (txState.meta.done) {
    return ClassicTransactionStepState.CHECK_TX_STATUS_SUCCESS;
  }
  if (currentTxId === null || currentTxId !== txState.tx.id) {
    return ClassicTransactionStepState.SIGN_IDLE;
  }

  switch (machineState._tag) {
    case "Signing":
      return ClassicTransactionStepState.SIGN_LOADING;
    case "SignFailed":
      return ClassicTransactionStepState.SIGN_ERROR;
    case "Submitting":
      return ClassicTransactionStepState.BROADCAST_LOADING;
    case "SubmissionFailed":
      return ClassicTransactionStepState.BROADCAST_ERROR;
    case "ConfirmationFailed":
      return ClassicTransactionStepState.CHECK_TX_STATUS_ERROR;
    case "Confirming":
    case "Advancing":
      return ClassicTransactionStepState.CHECK_TX_STATUS_LOADING;
    case "AdvanceFailed":
      return ClassicTransactionStepState.CHECK_TX_STATUS_ERROR;
    case "Completed":
      return ClassicTransactionStepState.CHECK_TX_STATUS_SUCCESS;
    case "Disabled":
      return ClassicTransactionStepState.SIGN_IDLE;
  }
};

const getClassicTransactionStepsView = (
  machineState: TransactionWorkflowState,
  workflowKey: ClassicTransactionWorkflowKey
) => {
  const workflowTransactions = flattenTransactionWorkflowTransactions(
    machineState.context
  );
  const currentTransaction = getCurrentTransactionWorkflowTransaction(
    machineState.context
  );
  const txStates = workflowTransactions.flatMap((transaction) => {
    if (transaction.source._tag !== "Classic") return [];

    const txState: ClassicTransactionState = {
      meta: transaction.meta,
      tx: transaction.source.transaction,
    };
    return [
      {
        ...txState,
        state: getClassicTransactionStepState({
          currentTxId: currentTransaction?.source.transaction.id ?? null,
          machineState,
          txState,
        }),
      },
    ];
  });
  const signError = currentTransaction?.meta.signError ?? null;
  const customSignErrorMessage =
    signError &&
    "customMessage" in signError &&
    typeof signError.customMessage === "string" &&
    signError.customMessage
      ? signError.customMessage
      : null;
  const completionNavigation =
    machineState._tag === "Completed"
      ? {
          state: {
            urls: workflowTransactions
              .filter((transaction) => transaction.source._tag === "Classic")
              .map((transaction) => ({
                type: transaction.source.transaction.type,
                url: transaction.meta.url,
              }))
              .filter(
                (value): value is { type: TransactionType; url: string } =>
                  !!value.url
              ),
          },
        }
      : null;

  return {
    completionNavigation,
    customSignErrorMessage,
    retryable:
      machineState._tag === "SignFailed" ||
      machineState._tag === "SubmissionFailed" ||
      machineState._tag === "ConfirmationFailed" ||
      machineState._tag === "AdvanceFailed",
    txStates,
    yieldId: workflowKey.yieldId,
  } as const;
};

export const transactionWorkflowMachineAtom = Atom.family(
  (workflowKey: TransactionWorkflowKey) => {
    const workflowId = getTransactionWorkflowId(workflowKey);

    return walletRuntime
      .atom(
        TransactionWorkflowService.use((service) => service.make(workflowKey))
      )
      .pipe(
        Atom.setIdleTTL(0),
        Atom.withLabel(`transactionWorkflow(${workflowId})`)
      );
  }
);

export const transactionWorkflowStateAtom = Atom.family(
  (workflowKey: TransactionWorkflowKey) => {
    const machineAtom = transactionWorkflowMachineAtom(workflowKey);
    const workflowId = getTransactionWorkflowId(workflowKey);

    return walletRuntime
      .atom((context) =>
        context.result(machineAtom).pipe(
          Effect.map((machine) => machine.states),
          Stream.unwrap
        )
      )
      .pipe(
        Atom.setIdleTTL(0),
        Atom.withLabel(`transactionWorkflowState(${workflowId})`)
      );
  }
);

export const transactionWorkflowDispatchAtom = Atom.family(
  (workflowKey: TransactionWorkflowKey) => {
    const machineAtom = transactionWorkflowMachineAtom(workflowKey);

    return walletRuntime
      .fn(
        (command: TransactionWorkflowCommand, context) =>
          context
            .result(machineAtom)
            .pipe(Effect.flatMap((machine) => machine.dispatch(command))),
        { concurrent: false }
      )
      .pipe(Atom.setIdleTTL(0));
  }
);

export const makeClassicTransactionWorkflowModule = (
  workflowKey: ClassicTransactionWorkflowKey
) => {
  const workflowId = getTransactionWorkflowId(workflowKey);
  const machineAtom = walletRuntime
    .atom(
      TransactionWorkflowService.use((service) => service.make(workflowKey))
    )
    .pipe(
      Atom.setIdleTTL(0),
      Atom.withLabel(`classicExecutionWorkflow(${workflowId})`)
    );
  const stateAtom = walletRuntime
    .atom((context) =>
      context.result(machineAtom).pipe(
        Effect.map((machine) => machine.states),
        Stream.unwrap
      )
    )
    .pipe(
      Atom.setIdleTTL(0),
      Atom.withLabel(`classicExecutionWorkflowState(${workflowId})`)
    );
  const completionAtom = walletRuntime
    .atom(
      (context) =>
        Effect.gen(function* () {
          const machine = yield* context.result(machineAtom);

          return machine.events.pipe(
            Stream.filter(
              (event) =>
                event._tag === "TransactionWorkflowCompleted" &&
                event.context.domain._tag === "Classic"
            ),
            Stream.tap(() =>
              Effect.sync(() => {
                context.set(
                  actionHistoryTimestampAtom,
                  markActionHistoryChanged()
                );
              })
            ),
            Stream.map(() => undefined)
          );
        }).pipe(Stream.unwrap),
      { initialValue: undefined }
    )
    .pipe(
      Atom.setIdleTTL(0),
      Atom.withLabel(`classicExecutionWorkflowCompletion(${workflowId})`)
    );

  const viewAtom = Atom.make((get) => {
    get(completionAtom);
    const result = get(stateAtom);
    const state = Option.getOrElse(AsyncResult.value(result), () =>
      initializeTransactionWorkflow(workflowKey)
    );

    return {
      result,
      state,
      steps: getClassicTransactionStepsView(state, workflowKey),
      workflowKey,
    } as const;
  }).pipe(Atom.setIdleTTL(0), Atom.withLabel("classicExecutionWorkflowView"));

  const dispatchAtom = walletRuntime
    .fn(
      (command: TransactionWorkflowCommand, context) =>
        context
          .result(machineAtom)
          .pipe(Effect.flatMap((machine) => machine.dispatch(command))),
      { concurrent: false }
    )
    .pipe(Atom.setIdleTTL(0));

  return {
    dispatchAtom,
    viewAtom,
  } as const;
};
