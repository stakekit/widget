import { useGasWarningCheck } from "@sk-widget/hooks/use-gas-warning-check";
import { useEnterStakeState } from "@sk-widget/providers/enter-stake-state";
import { useActionEnterGasEstimation } from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import { useMemo } from "react";

export const useStakeEnterData = () => {
  const enterRequest = useEnterStakeState().unsafeCoerce();

  const actionEnterGasEstimation = useActionEnterGasEstimation(
    enterRequest.requestDto
  );

  const stakeEnterTxGas = useMemo(
    () =>
      Maybe.fromNullable(actionEnterGasEstimation.data?.amount).map(BigNumber),
    [actionEnterGasEstimation.data]
  );

  const stakeAmount = useMemo(
    () => new BigNumber(enterRequest.requestDto.args.amount),
    [enterRequest]
  );

  const gasCheckWarning = useGasWarningCheck({
    gasAmount: stakeEnterTxGas,
    gasFeeToken: enterRequest.gasFeeToken,
    address: enterRequest.requestDto.addresses.address,
    additionalAddresses: enterRequest.requestDto.addresses.additionalAddresses,
    isStake: true,
    stakeAmount,
    stakeToken: enterRequest.selectedToken,
  });

  return {
    stakeEnterTxGas,
    enterRequest,
    stakeAmount,
    isGasCheckWarning: !!gasCheckWarning.data,
    gasCheckLoading:
      actionEnterGasEstimation.isLoading || gasCheckWarning.isLoading,
  };
};
