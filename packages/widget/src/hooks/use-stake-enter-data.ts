import {
  GasTokenMissingError,
  NotEnoughGasTokenError,
  checkGasAmount,
} from "@sk-widget/common/check-gas-amount";
import { useEnterStakeRequestDto } from "@sk-widget/providers/enter-stake-request-dto";
import {
  useActionEnterGasEstimation,
  useTokenGetTokenBalancesHook,
} from "@stakekit/api-hooks";
import { useQuery } from "@tanstack/react-query";
import BigNumber from "bignumber.js";
import { EitherAsync, Maybe } from "purify-ts";
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

  const tokenGetTokenBalances = useTokenGetTokenBalancesHook();

  const { data: isGasCheckError, isPending } = useQuery({
    queryKey: [
      "gas-check",
      stakeEnterTxGas.mapOrDefault((v) => v.toString(), ""),
    ],
    enabled: stakeEnterTxGas.isJust(),
    staleTime: 0,
    queryFn: async () => {
      return (
        await EitherAsync.liftEither(
          stakeEnterTxGas.toEither(new Error("No gas amount"))
        ).chain((val) =>
          checkGasAmount({
            gasEstimate: {
              amount: val,
              token: enterRequestDto.gasFeeToken,
            },
            addressWithTokenDto: {
              address: enterRequestDto.dto.addresses.address,
              network: enterRequestDto.gasFeeToken.network,
            },
            tokenGetTokenBalances,
            isStake: true,
            stakeAmount: new BigNumber(enterRequestDto.dto.args.amount),
            stakeToken: enterRequestDto.selectedToken,
          })
        )
      )
        .map(
          (val) =>
            val instanceof NotEnoughGasTokenError ||
            val instanceof GasTokenMissingError
        )
        .unsafeCoerce();
    },
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
