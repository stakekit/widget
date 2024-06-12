import {
  GasTokenMissingError,
  NotEnoughGasTokenError,
  checkGasAmount,
} from "@sk-widget/common/check-gas-amount";
import { useExitStakeRequestDto } from "@sk-widget/providers/exit-stake-request-dto";
import {
  useActionExitGasEstimate,
  useTokenGetTokenBalancesHook,
} from "@stakekit/api-hooks";
import { useQuery } from "@tanstack/react-query";
import BigNumber from "bignumber.js";
import { EitherAsync, Maybe } from "purify-ts";
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
  const tokenGetTokenBalances = useTokenGetTokenBalancesHook();

  const { data: isGasCheckError, isPending } = useQuery({
    queryKey: [
      "gas-check",
      stakeExitTxGas.mapOrDefault((v) => v.toString(), ""),
    ],
    enabled: stakeExitTxGas.isJust(),
    staleTime: 0,
    queryFn: async () => {
      return (
        await EitherAsync.liftEither(
          stakeExitTxGas.toEither(new Error("No gas amount"))
        ).chain((val) =>
          checkGasAmount({
            gasEstimate: {
              amount: val,
              token: exitRequestDto.gasFeeToken,
            },
            addressWithTokenDto: {
              address: exitRequestDto.dto.addresses.address,
              network: exitRequestDto.gasFeeToken.network,
            },
            tokenGetTokenBalances,
            isStake: true,
            stakeAmount: new BigNumber(exitRequestDto.dto.args.amount),
            stakeToken: exitRequestDto.unstakeToken,
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
