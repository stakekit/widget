import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ActionDto, TransactionType } from "@stakekit/api-hooks";
import { Maybe } from "purify-ts";
import { useSavedRef } from "../../../hooks";
import { TxState, useStepsMachine } from "./use-steps-machine.hook";
import { invalidateYieldBalances } from "../../../hooks/api/use-yield-balances-scan";
import { invalidateTokenAvailableAmount } from "../../../hooks/api/use-token-available-amount";
import { useRegisterFooterButton } from "../../components/footer-outlet/context";
import { useTranslation } from "react-i18next";

export const useSteps = ({
  session,
  onDone,
  onSignSuccess,
  onSubmitSuccess,
}: {
  onDone?: () => void;
  onSignSuccess?: () => void;
  onSubmitSuccess?: () => void;
  session: Maybe<ActionDto>;
}) => {
  const navigate = useNavigate();

  const callbacksRef = useSavedRef({
    onSignSuccess,
    onSubmitSuccess,
    onDone,
  });

  const [machine, send] = useStepsMachine();

  const sessionExtracted = useMemo(() => session.extractNullable(), [session]);

  /**
   *
   * @summary Start sign + check tx on mount
   */
  useEffect(() => {
    if (!sessionExtracted) return;

    send({
      type: "START",
      session: sessionExtracted,
    });
  }, [sessionExtracted, send]);

  /**
   *
   * @summary Callbacks
   */
  useEffect(() => {
    if (machine.event.type === "SIGN_SUCCESS") {
      callbacksRef.current.onSignSuccess?.();
    } else if (machine.event.type === "BROADCAST_SUCCESS") {
      callbacksRef.current.onSubmitSuccess?.();
    }
  }, [machine.event.type, callbacksRef]);

  /**
   *
   * @summary Clear timeout on unmount
   */
  useEffect(() => {
    return () => {
      const timeoutId = machine.context.txCheckTimeoutId;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [machine.context.txCheckTimeoutId]);

  /**
   *
   * @summary Navigate to next page
   */
  useEffect(() => {
    if (machine.value === "done") {
      callbacksRef.current.onDone?.();
      invalidateYieldBalances();
      invalidateTokenAvailableAmount();

      navigate("../complete", {
        state: {
          urls: machine.context.txStates
            .map((val) => ({ type: val.tx.type, url: val.meta.url }))
            .filter(
              (val): val is { type: TransactionType; url: string } => !!val.url
            ),
        },
        relative: "path",
        replace: true,
      });
    }
  }, [callbacksRef, machine.context.txStates, machine.value, navigate]);

  const onClick = () => navigate(-1);

  const retry = (() => {
    switch (machine.value) {
      case "signError": {
        return () => send({ type: "SIGN_RETRY" });
      }
      case "broadcastError": {
        return () => send({ type: "BROADCAST_RETRY" });
      }
      case "txCheckError": {
        return () => send({ type: "BROADCAST_RETRY" });
      }
    }
  })();

  const txStates = useMemo(
    () =>
      machine.context.txStates.map((val) => ({
        ...val,
        state: getState({
          txState: val,
          machineState: machine.value,
          currentTxId: machine.context.currentTxMeta?.id ?? null,
        }),
      })),
    [machine.context.currentTxMeta, machine.context.txStates, machine.value]
  );

  const { t } = useTranslation();

  const onClickRef = useSavedRef(onClick);

  useRegisterFooterButton(
    useMemo(
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
    )
  );

  return {
    retry,
    txStates,
  };
};

export enum TxStateEnum {
  SIGN_IDLE = 0,
  SIGN_ERROR,
  SIGN_LOADING,
  SIGN_SUCCESS,

  BROADCAST_IDLE,
  BROADCAST_ERROR,
  BROADCAST_LOADING,
  BROADCAST_SUCCESS,

  CHECK_TX_STATUS_IDLE,
  CHECK_TX_STATUS_ERROR,
  CHECK_TX_STATUS_LOADING,
  CHECK_TX_STATUS_SUCCESS,
}

const getState = ({
  currentTxId,
  machineState,
  txState,
}: {
  txState: TxState;
  machineState: ReturnType<typeof useStepsMachine>[0]["value"];
  currentTxId: string | null;
}) => {
  const isActive = currentTxId === null ? false : currentTxId === txState.tx.id;

  const state = (() => {
    if (txState.meta.done) return TxStateEnum.CHECK_TX_STATUS_SUCCESS;
    if (!isActive) return TxStateEnum.SIGN_IDLE;

    switch (machineState) {
      case "idle":
        return TxStateEnum.SIGN_IDLE;
      case "signLoading":
        return TxStateEnum.SIGN_LOADING;
      case "signError":
        return TxStateEnum.SIGN_ERROR;
      case "broadcastLoading":
        return TxStateEnum.BROADCAST_LOADING;
      case "broadcastError":
        return TxStateEnum.BROADCAST_ERROR;
      case "txCheckError":
        return TxStateEnum.CHECK_TX_STATUS_ERROR;
      case "txCheckRetry":
      case "txCheckLoading":
        return TxStateEnum.CHECK_TX_STATUS_LOADING;
      case "done":
        return TxStateEnum.CHECK_TX_STATUS_SUCCESS;
    }
  })();

  return state;
};
