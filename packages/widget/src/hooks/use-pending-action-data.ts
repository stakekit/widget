import { usePendingActionAndTxsConstruct } from "@sk-widget/hooks/api/use-pending-action-and-txs-construct";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import { useMemo } from "react";

export const usePendingActionData = () => {
  const pendingActionAndTxsConstructMutationState =
    usePendingActionAndTxsConstruct();

  const pendingActionAndTxsConstructData = useMemo(
    () => Maybe.fromNullable(pendingActionAndTxsConstructMutationState.data),
    [pendingActionAndTxsConstructMutationState.data]
  );

  const pendingActionSession = useMemo(
    () => pendingActionAndTxsConstructData.map((val) => val.actionDto),
    [pendingActionAndTxsConstructData]
  );

  const pendingActionData = useMemo(
    () => pendingActionAndTxsConstructData.map((val) => val.pendingActionData),
    [pendingActionAndTxsConstructData]
  );

  const pendingActionTxGas = useMemo(
    () => pendingActionSession.map((val) => val.gasEstimate.amount),
    [pendingActionSession]
  );

  const isGasCheckError = useMemo(
    () =>
      pendingActionAndTxsConstructData
        .chainNullable((val) => val.gasCheckErr)
        .isJust(),
    [pendingActionAndTxsConstructData]
  );

  const amount = useMemo(
    () => pendingActionSession.map((val) => new BigNumber(val.amount ?? 0)),
    [pendingActionSession]
  );

  const pendingActionType = useMemo(
    () => pendingActionSession.map((val) => val.type),
    [pendingActionSession]
  );

  return {
    pendingActionSession,
    pendingActionData,
    isGasCheckError,
    pendingActionTxGas,
    amount,
    pendingActionType,
  };
};
