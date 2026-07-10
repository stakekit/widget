import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import BigNumber from "bignumber.js";
import { Data, Duration, Effect, Option, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type { Maybe } from "purify-ts";
import {
  valueEqualAtomFamily,
  withApiRequestError,
  withApiResourcePolicy,
  withResponseDecodeError,
} from "../atoms/api-resource";
import { checkGasAmount } from "../common/check-gas-amount";
import {
  type GasBalancesCommand,
  GasBalancesCommand as GasBalancesCommandSchema,
  GasTokenBalancesResponse,
} from "../domain/schema/financial-models";
import type { AddressesDto } from "../domain/types/addresses";
import type { TokenDto } from "../domain/types/tokens";
import { StakeKitApiService } from "../providers/api/api-client";
import { stakeKitApiRuntime } from "../providers/effect-atom-runtime/stakekit-api-service";

type StakeTokenKey = {
  readonly address?: string;
  readonly network: string;
  readonly symbol: string;
};

class GasWarningKey extends Data.Class<{
  readonly command: GasBalancesCommand | null;
  readonly gasAmount: string | null;
  readonly stakeAmount: string | null;
  readonly stakeToken: StakeTokenKey | null;
}> {}

const gasWarningAtom = valueEqualAtomFamily((key: GasWarningKey) =>
  stakeKitApiRuntime
    .atom(() =>
      Effect.gen(function* () {
        if (!key.command || !key.gasAmount) return null;

        const api = yield* StakeKitApiService;
        const response = yield* api.legacy
          .TokenControllerGetTokenBalances({ payload: key.command })
          .pipe(withApiRequestError("gas-balance-check"));
        const balances = yield* Schema.decodeUnknownEffect(
          GasTokenBalancesResponse
        )(response).pipe(withResponseDecodeError("gas-balance-check"));

        return checkGasAmount({
          gasEstimate: new BigNumber(key.gasAmount),
          gasTokenBalance: balances[0],
          ...(key.stakeAmount && key.stakeToken
            ? {
                isStake: true as const,
                stakeAmount: new BigNumber(key.stakeAmount),
                stakeToken: key.stakeToken,
              }
            : { isStake: false as const }),
        });
      })
    )
    .pipe(
      withApiResourcePolicy({
        idleTTL: Duration.minutes(5),
        staleTime: Duration.zero,
        revalidateOnMount: true,
      })
    )
);

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
  const gasAmount = props.gasAmount.extractNullable();
  const command = Schema.decodeUnknownOption(GasBalancesCommandSchema)({
    addresses: [
      {
        address: props.address,
        ...(props.additionalAddresses
          ? { additionalAddresses: props.additionalAddresses }
          : {}),
        network: props.gasFeeToken.network,
        ...(props.gasFeeToken.address
          ? { tokenAddress: props.gasFeeToken.address }
          : {}),
      },
    ],
  }).pipe(Option.getOrNull);
  const resource = gasWarningAtom(
    new GasWarningKey({
      command,
      gasAmount: gasAmount?.toFixed() ?? null,
      stakeAmount: props.isStake ? props.stakeAmount.toFixed() : null,
      stakeToken: props.isStake
        ? {
            ...(props.stakeToken.address
              ? { address: props.stakeToken.address }
              : {}),
            network: props.stakeToken.network,
            symbol: props.stakeToken.symbol,
          }
        : null,
    })
  );
  const result = useAtomValue(resource);
  const refresh = useAtomRefresh(resource);
  const value = result.pipe(AsyncResult.value, Option.getOrUndefined);
  const enabled = !!(command && gasAmount);

  return {
    data: value ?? undefined,
    error: result.pipe(AsyncResult.error, Option.getOrUndefined),
    isError: AsyncResult.isFailure(result),
    isFetching: result.waiting,
    isLoading: enabled && AsyncResult.isInitial(result),
    refetch: refresh,
  } as const;
};
