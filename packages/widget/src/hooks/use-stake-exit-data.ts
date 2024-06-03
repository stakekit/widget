import { useStakeExitAndTxsConstruct } from "@sk-widget/hooks/api/use-stake-exit-and-txs-construct";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import { useMemo } from "react";

export const useStakeExitData = () => {
  const stakeExitAndTxsConstructMutationState = useStakeExitAndTxsConstruct();

  const stakeExitAndTxsConstructData = useMemo(
    () => Maybe.fromNullable(stakeExitAndTxsConstructMutationState.data),
    [stakeExitAndTxsConstructMutationState.data]
  );

  const stakeExitSession = useMemo(
    () => stakeExitAndTxsConstructData.map((val) => val.actionDto),
    [stakeExitAndTxsConstructData]
  );

  const stakeExitData = useMemo(
    () => stakeExitAndTxsConstructData.map((val) => val.stakeExitData),
    [stakeExitAndTxsConstructData]
  );

  const stakeExitTxGas = useMemo(
    () => stakeExitSession.map((val) => val.gasEstimate.amount),
    [stakeExitSession]
  );

  const isGasCheckError = useMemo(
    () =>
      stakeExitAndTxsConstructData
        .chainNullable((val) => val.gasCheckErr)
        .isJust(),
    [stakeExitAndTxsConstructData]
  );

  const amount = useMemo(
    () => stakeExitSession.map((val) => new BigNumber(val.amount ?? 0)),
    [stakeExitSession]
  );

  return {
    stakeExitSession,
    stakeExitData,
    isGasCheckError,
    stakeExitTxGas,
    amount,
  };
};
