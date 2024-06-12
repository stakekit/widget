import {
  GasTokenMissingError,
  NotEnoughGasTokenError,
  checkGasAmount,
} from "@sk-widget/common/check-gas-amount";
import { usePendingStakeRequestDto } from "@sk-widget/providers/pending-stake-request-dto";
import {
  useActionPendingGasEstimate,
  useTokenGetTokenBalancesHook,
} from "@stakekit/api-hooks";
import { useQuery } from "@tanstack/react-query";
import BigNumber from "bignumber.js";
import { EitherAsync, Maybe } from "purify-ts";
import { useMemo } from "react";

export const usePendingActionData = () => {
  const pendingRequest = usePendingStakeRequestDto();
  const pendingRequestDto = useMemo(
    () => Maybe.fromNullable(pendingRequest).unsafeCoerce(),
    [pendingRequest]
  );
  const { data, isFetching } = useActionPendingGasEstimate(pendingRequestDto);

  const tokenGetTokenBalances = useTokenGetTokenBalancesHook();

  const pendingTxGas = Maybe.fromNullable(data?.amount).map(
    (val) => new BigNumber(val)
  );

  const { data: isGasCheckError, isPending } = useQuery({
    queryKey: ["gas-check", pendingTxGas.mapOrDefault((v) => v.toString(), "")],
    enabled: pendingTxGas.isJust(),
    staleTime: 0,
    queryFn: async () => {
      return (
        await EitherAsync.liftEither(
          pendingTxGas.toEither(new Error("No gas amount"))
        ).chain((val) =>
          checkGasAmount({
            gasEstimate: {
              amount: val,
              token: pendingRequestDto.gasFeeToken,
            },
            addressWithTokenDto: {
              address: pendingRequestDto.address,
              network: pendingRequestDto.gasFeeToken.network,
            },
            tokenGetTokenBalances,
            isStake: false,
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
