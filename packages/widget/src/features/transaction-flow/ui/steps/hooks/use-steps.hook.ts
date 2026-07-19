import { useAtomSet } from "@effect/atom-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import type { YieldAction } from "../../../../../domain/schema/action-models";
import type { TransactionType } from "../../../../../domain/types/action";

import type {
  TransactionWorkflowState,
  TransactionWorkflowTransactionMeta,
} from "../../../../../services/workflow/transaction-workflow-model";
import {
  flattenTransactionWorkflowTransactions,
  getCurrentTransactionWorkflowTransaction,
} from "../../../../../services/workflow/transaction-workflow-model";
import { useSavedRef } from "../../../../../shared/react/use-saved-ref";
import { useTrackEvent } from "../../../../tracking/react/use-track-event";
import type { PageCta } from "../../../../widget-shell/page-cta";
import { classicTransactionFlowFacade } from "../../../state/classic-flow-facade";
import { useTransactionWorkflow } from "./use-transaction-workflow.hook";

export const useSteps = () => {
  const navigate = useNavigate();

  const {
    dispatch,
    flowIdentity,
    state: machineState,
    workflowKey,
  } = useTransactionWorkflow();
  const returnFlowToReview = useAtomSet(
    classicTransactionFlowFacade.returnToReviewAtom
  );

  const trackEvent = useTrackEvent();

  const onClick = () => {
    if (flowIdentity) returnFlowToReview(flowIdentity);
    trackEvent("actionStepsCancelled");
    navigate(-1);
  };

  const retry = (() => {
    if (
      machineState._tag === "SignFailed" ||
      machineState._tag === "SubmissionFailed" ||
      machineState._tag === "ConfirmationFailed" ||
      machineState._tag === "AdvanceFailed"
    ) {
      return () => dispatch({ _tag: "Retry" });
    }
  })();

  const workflowTransactions = flattenTransactionWorkflowTransactions(
    machineState.context
  );
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
  const currentTransaction = getCurrentTransactionWorkflowTransaction(
    machineState.context
  );
  const txStates = useMemo(
    () =>
      workflowTransactions.flatMap((transaction) => {
        if (transaction.source._tag !== "Classic") return [];

        const txState: ClassicTransactionState = {
          meta: transaction.meta,
          tx: transaction.source.transaction,
        };

        return [
          {
            ...txState,
            state: getState({
              txState,
              machineState,
              currentTxId: currentTransaction?.source.transaction.id ?? null,
            }),
          },
        ];
      }),
    [currentTransaction, machineState, workflowTransactions]
  );

  const customSignErrorMessage = useMemo(() => {
    const error = currentTransaction?.meta.signError ?? null;

    if (!error || !("customMessage" in error)) return null;

    return typeof error.customMessage === "string" && error.customMessage
      ? error.customMessage
      : null;
  }, [currentTransaction]);

  const { t } = useTranslation();

  const onClickRef = useSavedRef(onClick);

  const cta = useMemo<PageCta>(
    () =>
      txStates.length
        ? {
            disabled: false,
            isLoading: false,
            label: t("shared.cancel"),
            onClick: () => onClickRef.current(),
            variant: "secondary",
          }
        : null,
    [txStates.length, t, onClickRef]
  );

  return {
    retry,
    txStates,
    cta,
    customSignErrorMessage,
    completionNavigation,
    yieldId: workflowKey.yieldId,
  };
};

export enum TxStateEnum {
  SIGN_IDLE = 0,
  SIGN_ERROR = 1,
  SIGN_LOADING = 2,
  SIGN_SUCCESS = 3,

  // BROADCAST_IDLE = 4,
  BROADCAST_ERROR = 5,
  BROADCAST_LOADING = 6,
  BROADCAST_SUCCESS = 7,

  // CHECK_TX_STATUS_IDLE = 8,
  CHECK_TX_STATUS_ERROR = 9,
  CHECK_TX_STATUS_LOADING = 10,
  CHECK_TX_STATUS_SUCCESS = 11,
}

const getState = ({
  currentTxId,
  machineState,
  txState,
}: {
  txState: ClassicTransactionState;
  machineState: TransactionWorkflowState;
  currentTxId: string | null;
}) => {
  const isActive = currentTxId === null ? false : currentTxId === txState.tx.id;

  const state = (() => {
    if (txState.meta.done) return TxStateEnum.CHECK_TX_STATUS_SUCCESS;
    if (!isActive) return TxStateEnum.SIGN_IDLE;

    switch (machineState._tag) {
      case "Signing":
        return TxStateEnum.SIGN_LOADING;
      case "SignFailed":
        return TxStateEnum.SIGN_ERROR;
      case "Submitting":
        return TxStateEnum.BROADCAST_LOADING;
      case "SubmissionFailed":
        return TxStateEnum.BROADCAST_ERROR;
      case "ConfirmationFailed":
        return TxStateEnum.CHECK_TX_STATUS_ERROR;
      case "Confirming":
        return TxStateEnum.CHECK_TX_STATUS_LOADING;
      case "Advancing":
        return TxStateEnum.CHECK_TX_STATUS_LOADING;
      case "AdvanceFailed":
        return TxStateEnum.CHECK_TX_STATUS_ERROR;
      case "Completed":
        return TxStateEnum.CHECK_TX_STATUS_SUCCESS;
      case "Disabled":
        return TxStateEnum.SIGN_IDLE;
    }
  })();

  return state;
};

type ClassicTransactionState = {
  readonly meta: TransactionWorkflowTransactionMeta;
  readonly tx: YieldAction["transactions"][number];
};
