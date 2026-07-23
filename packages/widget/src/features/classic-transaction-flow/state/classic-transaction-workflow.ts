import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { YieldAction } from "../../../domain/schema/action-models";
import type { TransactionType } from "../../../domain/types/action";
import type {
  ClassicTransactionWorkflowInput,
  TransactionWorkflowState,
  TransactionWorkflowTransactionMeta,
} from "../../../services/workflow/transaction-workflow-model";
import {
  flattenTransactionWorkflowTransactions,
  getCurrentTransactionWorkflowTransaction,
  initializeTransactionWorkflow,
} from "../../../services/workflow/transaction-workflow-model";
import { makeTransactionWorkflowModule } from "../../transaction-workflow/state";
import {
  actionHistoryRevisionAtom,
  incrementActionHistoryRevision,
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
  workflowInput: ClassicTransactionWorkflowInput
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
    yieldId: workflowInput.yieldId,
  } as const;
};

export const makeClassicTransactionWorkflowModule = (
  workflowInput: ClassicTransactionWorkflowInput
) => {
  const workflowAtom = makeTransactionWorkflowModule(workflowInput);

  return Atom.make((context) => {
    const registry = context.registry;
    const workflow = context(workflowAtom);
    context.subscribe(
      workflow.eventsAtom,
      Option.match({
        onNone: () => undefined,
        onSome: (event) => {
          if (
            event._tag === "TransactionWorkflowCompleted" &&
            event.context.domain._tag === "Classic"
          ) {
            registry.set(
              actionHistoryRevisionAtom,
              incrementActionHistoryRevision(
                registry.get(actionHistoryRevisionAtom)
              )
            );
          }
        },
      }),
      { immediate: true }
    );
    const viewAtom = Atom.make((get) => {
      const result = get(workflow.stateAtom);
      const state = Option.getOrElse(AsyncResult.value(result), () =>
        initializeTransactionWorkflow(workflowInput)
      );

      return {
        result,
        state,
        steps: getClassicTransactionStepsView(state, workflowInput),
        workflowInput,
      } as const;
    }).pipe(Atom.setIdleTTL(0), Atom.withLabel("classicExecutionWorkflowView"));

    return {
      dispatchAtom: workflow.commandAtom,
      viewAtom,
    } as const;
  }).pipe(
    Atom.setIdleTTL(0),
    Atom.withLabel("classicTransactionWorkflowScope")
  );
};
