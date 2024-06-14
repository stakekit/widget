import {
  GasTokenMissingError,
  NotEnoughGasTokenError,
  checkGasAmount,
} from "@sk-widget/common/check-gas-amount";
import {
  type AddressWithTokenDto,
  type AddressesDto,
  type TokenDto,
  useTokenGetTokenBalancesHook,
} from "@stakekit/api-hooks";
import { useQuery } from "@tanstack/react-query";
import type BigNumber from "bignumber.js";
import { EitherAsync, Maybe } from "purify-ts";

export const useGasCheck = ({
  gasAmount,
  token,
  address,
  network,
  isStake,
  stakeAmount,
  stakeToken,
}: {
  gasAmount: Maybe<BigNumber>;
  token: TokenDto;
  address: AddressesDto["address"] | null;
  network: AddressWithTokenDto["network"];
  isStake: boolean;
  stakeAmount: BigNumber;
  stakeToken: TokenDto;
}) => {
  const tokenGetTokenBalances = useTokenGetTokenBalancesHook();

  const stakeData = isStake
    ? { isStake, stakeAmount, stakeToken }
    : { isStake };

  const { data, isPending } = useQuery({
    queryKey: ["gas-check", gasAmount.mapOrDefault((v) => v.toString(), "")],
    enabled: gasAmount.isJust(),
    staleTime: 0,
    queryFn: async () => {
      return (
        await EitherAsync.liftEither(
          Maybe.fromRecord({
            gasAmount,
            address: Maybe.fromNullable(address),
          }).toEither(new Error("No address or gas amount provided."))
        ).chain((val) =>
          checkGasAmount({
            gasEstimate: {
              amount: val.gasAmount,
              token,
            },
            addressWithTokenDto: {
              address: val.address,
              network,
            },
            tokenGetTokenBalances,
            ...stakeData,
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
  return { data, isPending };
};
