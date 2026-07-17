import { useAtomValue } from "@effect/atom-react";
import BigNumber from "bignumber.js";
import { Data, Duration, Effect, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime";
import type { YieldAction } from "../../../domain/schema/action-models";
import type { GasBalancesCommand } from "../../../domain/schema/financial-models";
import type { AppToken } from "../../../domain/schema/legacy-models";
import { getTransactionGasEstimate } from "../../../domain/types/action";
import { checkGasAmount } from "../../../domain/types/gas";
import { LegacyApiService } from "../../../services/api/legacy-api-service";
import type { WalletScopeKey } from "../../../services/wallet/domain/scope";
import { withApiResourcePolicy } from "../../../shared/effect/api-resource";
import {
  type ActionPreviewIntent,
  CurrentActionPreviewKey,
  currentActionPreviewAtom,
} from "../resources/action-preview";
import { enterStakeRequestAtom } from "../state/enter-request";
import { exitStakeRequestAtom } from "../state/exit-request";
import { pendingActionRequestAtom } from "../state/pending-action-request";

class GasBalancesKey extends Data.Class<{
  readonly command: GasBalancesCommand;
}> {}

const gasBalancesAtom = Atom.family((key: GasBalancesKey) =>
  appRuntime
    .atom(() =>
      Effect.gen(function* () {
        const api = yield* LegacyApiService;
        return yield* api.getGasTokenBalances(key.command);
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

class CurrentGasWarningKey extends Data.Class<{
  readonly enabled: boolean;
  readonly intent: ActionPreviewIntent;
}> {}

type CurrentGasWarningInput = {
  readonly gasFeeToken: AppToken;
  readonly stakeAmount: BigNumber | null;
  readonly stakeToken: AppToken | null;
  readonly walletScope: WalletScopeKey;
};

const getCurrentGasWarningInput = (
  get: Atom.AtomContext,
  intent: ActionPreviewIntent
): CurrentGasWarningInput | null => {
  switch (intent) {
    case "enter": {
      const request = get(enterStakeRequestAtom);
      return request
        ? {
            gasFeeToken: request.gasFeeToken,
            stakeAmount: new BigNumber(
              request.requestDto.arguments?.amount ?? 0
            ),
            stakeToken: request.selectedToken,
            walletScope: request.walletScope,
          }
        : null;
    }
    case "exit": {
      const request = get(exitStakeRequestAtom);
      return request
        ? {
            gasFeeToken: request.gasFeeToken,
            stakeAmount: null,
            stakeToken: null,
            walletScope: request.walletScope,
          }
        : null;
    }
    case "manage": {
      const request = get(pendingActionRequestAtom);
      return request
        ? {
            gasFeeToken: request.gasFeeToken,
            stakeAmount: null,
            stakeToken: null,
            walletScope: request.walletScope,
          }
        : null;
    }
  }
};

const getGasAmount = (
  preview: AsyncResult.AsyncResult<YieldAction | null, unknown>
) => {
  const action = preview.pipe(AsyncResult.value, Option.getOrNull);
  if (!action) return null;

  const total = action.transactions.reduce((sum, transaction) => {
    const decoded = getTransactionGasEstimate(transaction);
    return sum.plus(decoded?.amount ?? 0);
  }, new BigNumber(0));

  return total.isZero() ? null : total;
};

const getGasBalancesCommand = (
  input: CurrentGasWarningInput
): GasBalancesCommand => {
  const { additionalAddresses, address } = input.walletScope;

  return {
    addresses: [
      {
        address,
        ...(additionalAddresses ? { additionalAddresses } : {}),
        network: input.gasFeeToken.network,
        ...(input.gasFeeToken.address
          ? { tokenAddress: input.gasFeeToken.address }
          : {}),
      },
    ],
  };
};

const currentGasWarningAtom = Atom.family((key: CurrentGasWarningKey) =>
  Atom.make((get) => {
    const input = key.enabled
      ? getCurrentGasWarningInput(get, key.intent)
      : null;
    const preview = get(
      currentActionPreviewAtom(
        new CurrentActionPreviewKey({
          enabled: key.enabled,
          intent: key.intent,
        })
      )
    );
    const gasAmount = getGasAmount(preview);

    if (!input || !gasAmount) return AsyncResult.success(null);

    return get(
      gasBalancesAtom(
        new GasBalancesKey({ command: getGasBalancesCommand(input) })
      )
    ).pipe(
      AsyncResult.map((balances) =>
        checkGasAmount({
          gasEstimate: gasAmount,
          gasTokenBalance: balances[0],
          ...(input.stakeAmount && input.stakeToken
            ? {
                isStake: true as const,
                stakeAmount: input.stakeAmount,
                stakeToken: input.stakeToken,
              }
            : { isStake: false as const }),
        })
      )
    );
  })
);

const currentGasBalancesRefreshAtom = Atom.family((key: CurrentGasWarningKey) =>
  Atom.make((get) => () => {
    const input = key.enabled
      ? getCurrentGasWarningInput(get, key.intent)
      : null;

    if (input) {
      get.refresh(
        gasBalancesAtom(
          new GasBalancesKey({ command: getGasBalancesCommand(input) })
        )
      );
    }
  })
);

export const useGasWarningCheck = ({
  enabled,
  intent,
}: {
  readonly enabled: boolean;
  readonly intent: ActionPreviewIntent;
}) => {
  const key = new CurrentGasWarningKey({ enabled, intent });
  const resource = currentGasWarningAtom(key);
  const refresh = useAtomValue(currentGasBalancesRefreshAtom(key));
  const result = useAtomValue(resource);
  const value = result.pipe(AsyncResult.value, Option.getOrUndefined);

  return {
    data: value ?? undefined,
    error: result.pipe(AsyncResult.error, Option.getOrUndefined),
    isError: AsyncResult.isFailure(result),
    isFetching: result.waiting,
    isLoading: enabled && AsyncResult.isInitial(result),
    refetch: refresh,
  } as const;
};
