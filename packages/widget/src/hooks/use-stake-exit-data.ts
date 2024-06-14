import { useGasCheck } from "@sk-widget/hooks/use-gas-check";
import { useExitStakeRequestDto } from "@sk-widget/providers/exit-stake-request-dto";
import { useActionExitGasEstimate } from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import { useMemo } from "react";

export const useStakeExitData = () => {
  const exitRequest = useExitStakeRequestDto();

  const exitRequestDto = useMemo(
    () => Maybe.fromNullable(exitRequest).unsafeCoerce(),
    [exitRequest]
  );

  const { data, isFetching } = useActionExitGasEstimate(exitRequestDto.dto);

  const stakeExitTxGas = Maybe.fromNullable(data?.amount).map(
    (val) => new BigNumber(val)
  );

  const { data: isGasCheckError, isPending } = useGasCheck({
    gasAmount: stakeExitTxGas,
    token: exitRequestDto.gasFeeToken,
    address: exitRequestDto.dto.addresses.address,
    network: exitRequestDto.gasFeeToken.network,
    isStake: true,
    stakeAmount: new BigNumber(exitRequestDto.dto.args.amount),
    stakeToken: exitRequestDto.unstakeToken,
  });

  const amount = useMemo(
    () =>
      Maybe.fromNullable(exitRequestDto).map(
        (val) => new BigNumber(val.unstakeAmount ?? 0)
      ),
    [exitRequestDto]
  );

  return {
    stakeExitSession: data,
    stakeExitData: Maybe.fromNullable({
      integrationData: exitRequestDto.integrationData,
      interactedToken: exitRequestDto.unstakeToken,
    }),
    isGasCheckError,
    stakeExitTxGas: Maybe.fromNullable(data?.amount).map((val) =>
      BigNumber(val)
    ),
    amount,
    gasEstimateLoading: isFetching || isPending,
  };
};
