import { Data, Duration, Effect, Stream } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { withApiResourcePolicy } from "../../atoms/api-resource";
import type { TokenBalanceScanCommand } from "../../domain/schema/financial-models";
import { StakeKitApiService } from "../../providers/api/api-service";
import { widgetAtomRuntime } from "../../providers/effect-atom-runtime/widget-runtime";
import { selectCurrentWalletAtom } from "../../providers/wallet";

export class TokenBalancesKey extends Data.Class<{
  readonly command: TokenBalanceScanCommand | null;
  readonly enabled: boolean;
}> {}

export const tokenBalancesAtom = Atom.family((key: TokenBalancesKey) =>
  widgetAtomRuntime
    .atom(() =>
      Effect.gen(function* () {
        if (!key.enabled || !key.command) return null;

        const api = yield* StakeKitApiService;
        return yield* api.legacy.scanTokenBalances(key.command);
      })
    )
    .pipe(
      withApiResourcePolicy({
        idleTTL: Duration.minutes(5),
        staleTime: Duration.minutes(1),
        revalidateOnMount: true,
      })
    )
);

const scheduledRefreshInterval = Duration.minutes(1);

const tokenBalancesScanCommandAtom = selectCurrentWalletAtom((walletState) => {
  if (
    !walletState.address ||
    !walletState.network ||
    walletState.isLedgerLiveAccountPlaceholder
  ) {
    return null;
  }

  return {
    addresses: {
      address: walletState.address,
      ...(walletState.additionalAddresses
        ? { additionalAddresses: walletState.additionalAddresses }
        : {}),
    },
    network: walletState.network,
  } satisfies TokenBalanceScanCommand;
}).pipe(Atom.withLabel("tokenBalancesScanCommandAtom"));

const tokenBalancesScanResourceAtom = widgetAtomRuntime
  .atom((get) =>
    Effect.gen(function* () {
      const command = get(tokenBalancesScanCommandAtom);
      if (!command) return null;

      const api = yield* StakeKitApiService;
      return yield* api.legacy.scanTokenBalances(command);
    })
  )
  .pipe(
    withApiResourcePolicy({
      idleTTL: Duration.minutes(5),
      staleTime: Duration.minutes(1),
      revalidateOnMount: true,
    }),
    Atom.withLabel("tokenBalancesScanResourceAtom")
  );

const tokenBalancesScheduledRefreshAtom = Atom.make(
  (get) =>
    get(tokenBalancesScanCommandAtom)
      ? Stream.tick(scheduledRefreshInterval).pipe(
          Stream.drop(1),
          Stream.tap(() =>
            Effect.sync(() => get.refresh(tokenBalancesScanResourceAtom))
          ),
          Stream.map(() => undefined)
        )
      : Stream.never,
  { initialValue: undefined }
).pipe(
  Atom.setIdleTTL(Duration.zero),
  Atom.withLabel("tokenBalancesScheduledRefreshAtom")
);

export const tokenBalancesScanAtom = Atom.readable(
  (get) => {
    get(tokenBalancesScheduledRefreshAtom);

    return {
      enabled: get(tokenBalancesScanCommandAtom) !== null,
      result: get(tokenBalancesScanResourceAtom),
    } as const;
  },
  (refresh) => refresh(tokenBalancesScanResourceAtom)
).pipe(Atom.withLabel("tokenBalancesScanAtom"));
