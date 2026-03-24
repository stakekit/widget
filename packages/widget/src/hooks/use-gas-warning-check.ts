import { useQuery } from "@tanstack/react-query";
import type BigNumber from "bignumber.js";
import { EitherAsync, type Maybe } from "purify-ts";
import { useMemo } from "react";
import {
  checkGasAmount,
  GasTokenMissingError,
  NotEnoughGasTokenError,
} from "../common/check-gas-amount";
import type { AddressesDto } from "../domain/types/addresses";
import type { TokenDto } from "../domain/types/tokens";

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
  ),
) => {
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
    [props],
  );

  return useQuery({
    queryKey: ["gas-check", requestData.extract()],
    enabled: requestData.isJust(),
    staleTime: 0,
    queryFn: async () => {
      return (
        await EitherAsync.liftEither(
          requestData.toEither(new Error("Request data is missing")),
        )
          .chain((val) =>
            checkGasAmount({
              gasEstimate: {
                amount: val.gasAmount,
                token: val.gasFeeToken as NonNullable<
                  Parameters<typeof checkGasAmount>[0]["gasEstimate"]
                >["token"],
              },
              addressWithTokenDto: {
                address: val.address,
                additionalAddresses: val.additionalAddresses,
                network: val.gasFeeToken.network as Parameters<
                  typeof checkGasAmount
                >[0]["addressWithTokenDto"]["network"],
                tokenAddress: val.gasFeeToken.address,
              },
              ...val.stakeData,
            }),
          )
          .map(
            (val) =>
              val instanceof NotEnoughGasTokenError ||
              val instanceof GasTokenMissingError,
          )
      ).unsafeCoerce();
    },
  });
};
