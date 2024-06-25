import {
  GasTokenMissingError,
  NotEnoughGasTokenError,
  checkGasAmount,
} from "@sk-widget/common/check-gas-amount";
import {
  type AddressesDto,
  type TokenDto,
  useTokenGetTokenBalancesHook,
} from "@stakekit/api-hooks";
import { useQuery } from "@tanstack/react-query";
import type BigNumber from "bignumber.js";
import { EitherAsync, type Maybe } from "purify-ts";
import { useMemo } from "react";

export const useGasWarningCheck = (
  props: {
    gasAmount: Maybe<BigNumber>;
    gasFeeToken: TokenDto;
    address: AddressesDto["address"];
    additionalAddresses: AddressesDto["additionalAddresses"];
    isStake: boolean;
  } & (
    | { isStake: true; stakeAmount: BigNumber; stakeToken: TokenDto }
    | { isStake: false }
  )
) => {
  const tokenGetTokenBalances = useTokenGetTokenBalancesHook();

  const requestData = useMemo(
    () =>
      props.gasAmount.map((v) => ({
        ...props,
        gasAmount: v,
        stakeData: props.isStake
          ? {
              isStake: props.isStake,
              stakeAmount: props.stakeAmount,
              stakeToken: props.stakeToken,
            }
          : { isStake: props.isStake },
      })),
    [props]
  );

  return useQuery({
    queryKey: ["gas-check"],
    enabled: requestData.isJust(),
    staleTime: 0,
    queryFn: async () => {
      return (
        await EitherAsync.liftEither(
          requestData.toEither(new Error("Request data is missing"))
        )
          .chain((val) =>
            checkGasAmount({
              gasEstimate: {
                amount: val.gasAmount,
                token: val.gasFeeToken,
              },
              addressWithTokenDto: {
                address: val.address,
                additionalAddresses: val.additionalAddresses,
                network: val.gasFeeToken.network,
                tokenAddress: val.gasFeeToken.address,
              },
              tokenGetTokenBalances,
              ...val.stakeData,
            })
          )
          .map(
            (val) =>
              val instanceof NotEnoughGasTokenError ||
              val instanceof GasTokenMissingError
          )
      ).unsafeCoerce();
    },
  });
};
