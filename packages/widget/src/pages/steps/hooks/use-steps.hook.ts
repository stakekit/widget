import { useSetActionHistoryData } from "@sk-widget/providers/stake-history";
import type { ActionDto, TransactionType } from "@stakekit/api-hooks";
import { useEffect, useLayoutEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useSavedRef } from "../../../hooks";
import { useInvalidateTokenBalances } from "../../../hooks/api/use-token-balances-scan";
import { useInvalidateYieldBalances } from "../../../hooks/api/use-yield-balances-scan";
import { useRegisterFooterButton } from "../../components/footer-outlet/context";
import type { TxState } from "./use-steps-machine.hook";
import { useStepsMachine } from "./use-steps-machine.hook";

export const useSteps = ({
  session,
  onSignSuccess,
}: {
  onSignSuccess?: () => void;
  session: ActionDto;
}) => {
  const navigate = useNavigate();

  const callbacksRef = useSavedRef({ onSignSuccess });

  const [machineState, send, actorRef] = useStepsMachine({
    transactions: session.transactions,
    integrationId: session.integrationId,
  });

  /**
   *
   * @summary Start sign + check tx on mount
   */
  useLayoutEffect(() => {
    send({ type: "START" });
  }, [send]);

  /**
   *
   * @summary Callbacks
   */
  useEffect(() => {
    const sub = actorRef.on("signSuccess", () =>
      callbacksRef.current.onSignSuccess?.()
    );

    return () => {
      sub.unsubscribe();
    };
  }, [actorRef, callbacksRef]);

  /**
   *
   * @summary Clear timeout on unmount
   */
  useEffect(() => {
    return () => {
      machineState.context.txCheckTimeoutId.ifJust((id) => clearTimeout(id));
    };
  }, [machineState.context.txCheckTimeoutId]);

  const invalidateYieldBalances = useInvalidateYieldBalances();
  const invalidateTokenBalances = useInvalidateTokenBalances();
  const setActionHistoryData = useSetActionHistoryData();

  /**
   *
   * @summary Navigate to next page
   */
  useEffect(() => {
    if (machineState.status === "done") {
      invalidateYieldBalances();
      invalidateTokenBalances();
      setActionHistoryData();

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
  }, [
    invalidateYieldBalances,
    invalidateTokenBalances,
    setActionHistoryData,
    navigate,
    machineState.context.txStates,
    machineState.status,
  ]);

  const onClick = () => navigate(-1);

  const retry = (() => {
    if (machineState.matches("signError")) {
      return () => send({ type: "__SIGN_RETRY__" });
    }

    if (machineState.matches("broadcastError")) {
      return () => send({ type: "__BROADCAST_RETRY__" });
    }

    if (machineState.matches("txCheckError")) {
      return () => send({ type: "__TX_CHECK_RETRY__" });
    }
  })();

  const txStates = useMemo(
    () =>
      machineState.context.txStates.map((val) => ({
        ...val,
        state: getState({
          txState: val,
          machineState: machineState.value,
          currentTxId: machineState.context.currentTxMeta
            .map((v) => v.id)
            .extractNullable(),
        }),
      })),
    [
      machineState.context.currentTxMeta,
      machineState.context.txStates,
      machineState.value,
    ]
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
  SIGN_ERROR = 1,
  SIGN_LOADING = 2,
  SIGN_SUCCESS = 3,

  BROADCAST_IDLE = 4,
  BROADCAST_ERROR = 5,
  BROADCAST_LOADING = 6,
  BROADCAST_SUCCESS = 7,

  CHECK_TX_STATUS_IDLE = 8,
  CHECK_TX_STATUS_ERROR = 9,
  CHECK_TX_STATUS_LOADING = 10,
  CHECK_TX_STATUS_SUCCESS = 11,
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
      case "disabled":
        return TxStateEnum.SIGN_IDLE;
    }
  })();

  return state;
};
