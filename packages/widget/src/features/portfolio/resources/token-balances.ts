import { Duration, Effect, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import type { TokenBalanceScanCommand } from "../../../domain/schema/financial-models";
import { LegacyApiService } from "../../../services/api/legacy-api-service";
import { resourceInvalidationKeys } from "../../../services/resource-invalidation";
import type { WalletScopeKey } from "../../../services/wallet/domain/scope";
import { withApiResourcePolicy } from "../../../shared/effect/api-resource";
import { currentWalletScopeAtom } from "../../wallet/state/selectors";

const scheduledRefreshInterval = Duration.minutes(1);

const getTokenBalancesScanCommand = (
  scope: WalletScopeKey
): TokenBalanceScanCommand => ({
  addresses: {
    address: scope.address,
    ...(scope.additionalAddresses
      ? { additionalAddresses: scope.additionalAddresses }
      : {}),
  },
  network: scope.network,
});

const tokenBalancesScanResourceAtomFamily = Atom.family(
  (scope: WalletScopeKey) =>
    appRuntime
      .atom(() =>
        Effect.gen(function* () {
          const api = yield* LegacyApiService;
          return yield* api.scanTokenBalances(
            getTokenBalancesScanCommand(scope)
          );
        })
      )
      .pipe(
        Atom.withReactivity(resourceInvalidationKeys.walletBalances(scope)),
        withApiResourcePolicy({
          idleTTL: Duration.minutes(5),
          staleTime: Duration.minutes(1),
          revalidateOnMount: true,
        }),
        Atom.withLabel("tokenBalancesScanResourceAtom")
      )
);

const refreshTokenBalancesScanAtom = Atom.family((scope: WalletScopeKey) =>
  Atom.fnSync((_input: undefined, get) =>
    get.refresh(tokenBalancesScanResourceAtomFamily(scope))
  )
);

const tokenBalancesScanResourceAtom = Atom.readable((get) => {
  const scope = get(currentWalletScopeAtom);

  return scope
    ? get(tokenBalancesScanResourceAtomFamily(scope))
    : AsyncResult.success([]);
}).pipe(Atom.withLabel("currentTokenBalancesScanResourceAtom"));

const tokenBalancesScheduledRefreshAtom = Atom.make(
  (get) =>
    get(currentWalletScopeAtom)
      ? Stream.tick(scheduledRefreshInterval).pipe(
          Stream.drop(1),
          Stream.tap(() =>
            Effect.sync(() => {
              const scope = get(currentWalletScopeAtom);
              if (scope) {
                get.refresh(tokenBalancesScanResourceAtomFamily(scope));
              }
            })
          ),
          Stream.map(() => undefined)
        )
      : Stream.never,
  { initialValue: undefined }
).pipe(
  Atom.setIdleTTL(Duration.zero),
  Atom.withLabel("tokenBalancesScheduledRefreshAtom")
);

export const tokenBalancesScanAtom = Atom.writable(
  (get) => {
    get(tokenBalancesScheduledRefreshAtom);

    return {
      enabled: get(currentWalletScopeAtom) !== null,
      result: get(tokenBalancesScanResourceAtom),
    } as const;
  },
  (get) => {
    const scope = get.get(currentWalletScopeAtom);
    if (scope) get.set(refreshTokenBalancesScanAtom(scope), undefined);
  }
).pipe(Atom.withLabel("tokenBalancesScanAtom"));
