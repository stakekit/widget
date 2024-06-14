import { useGasWarningCheck } from "@sk-widget/hooks/use-gas-warning-check";
import { useExitStakeState } from "@sk-widget/providers/exit-stake-state";
import { useActionExitGasEstimate } from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import { useMemo } from "react";

export const useStakeExitData = () => {
  const exitRequest = useExitStakeState().unsafeCoerce();

  const actionExitGasEstimate = useActionExitGasEstimate(
    exitRequest.requestDto
  );

  const stakeExitTxGas = useMemo(
    () => Maybe.fromNullable(actionExitGasEstimate.data?.amount).map(BigNumber),
    [actionExitGasEstimate.data]
  );

  const gasWarningCheck = useGasWarningCheck({
    gasAmount: stakeExitTxGas,
    gasFeeToken: exitRequest.gasFeeToken,
    address: exitRequest.requestDto.addresses.address,
    additionalAddresses: exitRequest.requestDto.addresses.additionalAddresses,
    isStake: false,
  });

  const amount = useMemo(
    () =>
      Maybe.fromNullable(exitRequest.requestDto.args.amount).map(
        (val) => new BigNumber(val ?? 0)
      ),
    [exitRequest.requestDto.args.amount]
  );

  return {
    stakeExitTxGas,
    exitRequest,
    amount,
    isGasCheckWarning: !!gasWarningCheck.data,
    gasCheckLoading:
      actionExitGasEstimate.isLoading || gasWarningCheck.isLoading,
  };
};
