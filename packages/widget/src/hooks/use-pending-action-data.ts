import { useGasWarningCheck } from "@sk-widget/hooks/use-gas-warning-check";
import { usePendingActionState } from "@sk-widget/providers/pending-action-state";
import { useActionPendingGasEstimate } from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import { useMemo } from "react";

export const usePendingActionData = () => {
  const pendingRequest = usePendingActionState().unsafeCoerce();

  const actionPendingGasEstimate = useActionPendingGasEstimate(
    pendingRequest.requestDto
  );

  const pendingTxGas = useMemo(
    () =>
      Maybe.fromNullable(actionPendingGasEstimate.data?.amount).map(BigNumber),
    [actionPendingGasEstimate.data]
  );

  const gasWarningCheck = useGasWarningCheck({
    gasAmount: pendingTxGas,
    gasFeeToken: pendingRequest.gasFeeToken,
    address: pendingRequest.addresses.address,
    additionalAddresses: pendingRequest.addresses.additionalAddresses,
    isStake: false,
  });

  const amount = useMemo(
    () =>
      Maybe.fromNullable(pendingRequest.requestDto.args?.amount).map(
        (val) => new BigNumber(val ?? 0)
      ),
    [pendingRequest.requestDto.args?.amount]
  );

  return {
    pendingTxGas,
    pendingRequest,
    amount,
    isGasCheckWarning: !!gasWarningCheck.data,
    gasCheckLoading:
      actionPendingGasEstimate.isLoading || gasWarningCheck.isLoading,
  };
};
