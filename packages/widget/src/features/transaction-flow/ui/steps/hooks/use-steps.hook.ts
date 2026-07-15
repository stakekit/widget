import { useAtomSubscribe } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useEffect, useLayoutEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import type { YieldAction } from "../../../../../domain/schema/action-models";
import type { AppToken } from "../../../../../domain/schema/legacy-models";
import type { TransactionType } from "../../../../../domain/types/action";

import type { ActionMeta } from "../../../../../public-api/types";
import type {
  StepsMachineState,
  StepsTransactionState,
} from "../../../../../services/workflow/steps-machine-model";
import { useSavedRef } from "../../../../../shared/react/use-saved-ref";
import type { useProvidersDetails } from "../../../../earn";
import { useTrackEvent } from "../../../../tracking";
import type { PageCta } from "../../../../widget-shell";
import { useStepsMachine } from "./use-steps-machine.hook";

export const useSteps = ({
  inputToken,
  session,
  onSignSuccess,
  providersDetails,
}: {
  onSignSuccess?: () => void;
  session: YieldAction;
  inputToken?: AppToken;
  providersDetails: ReturnType<typeof useProvidersDetails>;
}) => {
  const navigate = useNavigate();

  const callbacksRef = useSavedRef({ onSignSuccess });

  const actionMeta = useMemo(
    (): ActionMeta => ({
      actionId: session.id,
      actionType: session.type,
      address: session.address,
      amount: session.amount,
      amountRaw: session.amountRaw,
      rawArguments: session.rawArguments,
      yieldId: session.yieldId,
      inputToken,
      providersDetails:
        providersDetails?.map((v) => ({
          name: v.name,
          address: v.address,
          rewardRate: v.rewardRate,
          rewardType: v.rewardType,
          website: v.website,
          logo: v.logo,
        })) ?? [],
    }),
    [session, providersDetails, inputToken]
  );

  const {
    dispatch,
    eventsAtom,
    state: machineState,
  } = useStepsMachine({
    transactions: session.transactions,
    yieldId: session.yieldId,
    actionMeta,
  });

  /**
   *
   * @summary Start sign + check tx on mount
   */
  useLayoutEffect(() => {
    dispatch({ _tag: "Start" });
  }, [dispatch]);

  /**
   *
   * @summary Callbacks
   */
  useAtomSubscribe(eventsAtom, (result) => {
    if (
      AsyncResult.isSuccess(result) &&
      result.value._tag === "StepsSignSucceeded"
    ) {
      callbacksRef.current.onSignSuccess?.();
    }
  });

  /**
   *
   * @summary Navigate to next page
   */
  useEffect(() => {
    if (machineState._tag === "Completed") {
      navigate("../complete", {
        state: {
          urls: machineState.context.txStates
            .map((val) => ({ type: val.tx.type, url: val.meta.url }))
            .filter(
              (val): val is { type: TransactionType; url: string } => !!val.url
            ),
        },
        relative: "path",
        replace: true,
      });
    }
  }, [navigate, machineState.context.txStates, machineState._tag]);

  const trackEvent = useTrackEvent();

  const onClick = () => {
    trackEvent("actionStepsCancelled");
    navigate(-1);
  };

  const retry = (() => {
    if (machineState._tag === "SignFailed") {
      return () => dispatch({ _tag: "RetrySign" });
    }

    if (machineState._tag === "SubmissionFailed") {
      return () => dispatch({ _tag: "RetrySubmission" });
    }

    if (machineState._tag === "ConfirmationFailed") {
      return () => dispatch({ _tag: "RetryConfirmation" });
    }
  })();

  const txStates = useMemo(
    () =>
      machineState.context.txStates.map((val) => ({
        ...val,
        state: getState({
          txState: val,
          machineState,
          currentTxId:
            machineState.context.currentTxIndex === null
              ? null
              : (machineState.context.txStates[
                  machineState.context.currentTxIndex
                ]?.tx.id ?? null),
        }),
      })),
    [machineState, machineState.context.txStates]
  );

  const customSignErrorMessage = useMemo(() => {
    const error =
      machineState.context.currentTxIndex === null
        ? null
        : (machineState.context.txStates[machineState.context.currentTxIndex]
            ?.meta.signError ?? null);

    if (!error || !("customMessage" in error)) return null;

    return typeof error.customMessage === "string" && error.customMessage
      ? error.customMessage
      : null;
  }, [machineState.context.currentTxIndex, machineState.context.txStates]);

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
  txState: StepsTransactionState;
  machineState: StepsMachineState;
  currentTxId: string | null;
}) => {
  const isActive = currentTxId === null ? false : currentTxId === txState.tx.id;

  const state = (() => {
    if (txState.meta.done) return TxStateEnum.CHECK_TX_STATUS_SUCCESS;
    if (!isActive) return TxStateEnum.SIGN_IDLE;

    switch (machineState._tag) {
      case "Idle":
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
      case "Completed":
        return TxStateEnum.CHECK_TX_STATUS_SUCCESS;
      case "Disabled":
        return TxStateEnum.SIGN_IDLE;
    }
  })();

  return state;
};
