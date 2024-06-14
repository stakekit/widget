import { useGasCheck } from "@sk-widget/hooks/use-gas-check";
import { useEnterStakeRequestDto } from "@sk-widget/providers/enter-stake-request-dto";
import { useActionEnterGasEstimation } from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import { useMemo } from "react";

export const useStakeEnterData = () => {
  const enterRequest = useEnterStakeRequestDto();

  const enterRequestDto = useMemo(
    () => Maybe.fromNullable(enterRequest).unsafeCoerce(),
    [enterRequest]
  );

  const { data, isFetching } = useActionEnterGasEstimation(enterRequestDto.dto);

  const selectedStake = Maybe.of(enterRequestDto.selectedStake);
  const selectedValidators = enterRequestDto.selectedValidators;
  const selectedToken = Maybe.of(enterRequestDto.selectedToken);

  const stakeEnterTxGas = Maybe.fromNullable(data?.amount).map(
    (val) => new BigNumber(val)
  );

  const stakeAmount = useMemo(() => {
    return new BigNumber(enterRequestDto.dto.args.amount);
  }, [enterRequestDto]);

  const { data: isGasCheckError, isPending } = useGasCheck({
    gasAmount: stakeEnterTxGas,
    token: enterRequestDto.gasFeeToken,
    address: enterRequestDto.dto.addresses.address,
    network: enterRequestDto.gasFeeToken.network,
    isStake: true,
    stakeAmount,
    stakeToken: enterRequestDto.selectedToken,
  });

  return {
    selectedStake,
    selectedValidators,
    selectedToken,
    stakeEnterTxGas,
    enterRequestDto,
    isGasCheckError,
    gasEstimatePending: isFetching || isPending,
    stakeAmount,
  };
};
