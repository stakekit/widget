import { useGasCheck } from "@sk-widget/hooks/use-gas-check";
import { usePendingStakeRequestDto } from "@sk-widget/providers/pending-stake-request-dto";
import { useSKWallet } from "@sk-widget/providers/sk-wallet";
import { useActionPendingGasEstimate } from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import { useMemo } from "react";

export const usePendingActionData = () => {
  const pendingRequest = usePendingStakeRequestDto();
  const { address } = useSKWallet();
  const pendingRequestDto = useMemo(
    () => Maybe.fromNullable(pendingRequest).unsafeCoerce(),
    [pendingRequest]
  );
  const { data, isFetching } = useActionPendingGasEstimate(pendingRequestDto);

  const pendingTxGas = Maybe.fromNullable(data?.amount).map(
    (val) => new BigNumber(val)
  );

  const { data: isGasCheckError, isPending } = useGasCheck({
    gasAmount: pendingTxGas,
    token: pendingRequestDto.gasFeeToken,
    address,
    network: pendingRequestDto.gasFeeToken.network,
    isStake: false,
    stakeAmount: new BigNumber(0),
    stakeToken: pendingRequestDto.gasFeeToken,
  });

  const amount = useMemo(
    () =>
      Maybe.fromNullable(pendingRequestDto).map(
        (val) => new BigNumber(val.args?.amount ?? 0)
      ),
    [pendingRequestDto]
  );

  return {
    pendingActionSession: data,
    pendingActionData: pendingRequestDto.pendingActionData,
    pendingActionTxGas: data?.amount,
    amount,
    isGasCheckError,
    pendingActionType: pendingRequestDto.pendingActionType,
    gasEstimatePending: isFetching || isPending,
    pendingTxGas,
    pendingRequestDto,
  };
};
