import { useStakeEnterAndTxsConstruct } from "@sk-widget/hooks/api/use-stake-enter-and-txs-construct";
import { Maybe } from "purify-ts";
import { useMemo } from "react";

export const useStakeEnterData = () => {
  const stakeEnterAndTxsConstructMutationState = useStakeEnterAndTxsConstruct();

  const stakeEnterAndTxsConstructData = useMemo(
    () => Maybe.fromNullable(stakeEnterAndTxsConstructMutationState.data),
    [stakeEnterAndTxsConstructMutationState.data]
  );

  const stakeSession = useMemo(
    () => stakeEnterAndTxsConstructData.map((val) => val.actionDto),
    [stakeEnterAndTxsConstructData]
  );

  const stakeEnterData = useMemo(
    () => stakeEnterAndTxsConstructData.map((val) => val.stakeEnterData),
    [stakeEnterAndTxsConstructData]
  );

  const stakeEnterTxGas = useMemo(
    () =>
      stakeEnterAndTxsConstructData.map(
        (val) => val.actionDto.gasEstimate.amount
      ),
    [stakeEnterAndTxsConstructData]
  );

  const isGasCheckError = useMemo(
    () =>
      stakeEnterAndTxsConstructData
        .chainNullable((val) => val.gasCheckErr)
        .isJust(),
    [stakeEnterAndTxsConstructData]
  );

  return {
    stakeSession,
    stakeEnterData,
    isGasCheckError,
    stakeEnterTxGas,
  };
};
