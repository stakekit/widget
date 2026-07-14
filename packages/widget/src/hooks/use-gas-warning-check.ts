import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import BigNumber from "bignumber.js";
import { Data, Duration, Effect, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { withApiResourcePolicy } from "../atoms/api-resource";
import { checkGasAmount } from "../common/check-gas-amount";
import type { WalletAddresses } from "../domain/schema/address-models";
import type { GasBalancesCommand } from "../domain/schema/financial-models";
import type { AppToken } from "../domain/schema/legacy-models";

import { StakeKitApiService } from "../providers/api/api-service";
import { widgetAtomRuntime } from "../providers/effect-atom-runtime/widget-runtime";

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

const gasWarningAtom = Atom.family((key: GasWarningKey) =>
  widgetAtomRuntime
    .atom(() =>
      Effect.gen(function* () {
        if (!key.command || !key.gasAmount) return null;

        const api = yield* StakeKitApiService;
        const balances = yield* api.legacy.getGasTokenBalances(key.command);

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
    gasAmount: BigNumber | null;
    gasFeeToken: AppToken;
    address: WalletAddresses["address"];
    additionalAddresses: WalletAddresses["additionalAddresses"];
    isStake: boolean;
  } & (
    | { isStake: true; stakeAmount: BigNumber; stakeToken: AppToken }
    | { isStake: false }
  )
) => {
  const gasAmount = props.gasAmount;
  const command = {
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
  } satisfies GasBalancesCommand;
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
