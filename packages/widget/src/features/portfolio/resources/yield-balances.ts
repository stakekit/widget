import { Clock, Duration, Effect, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import type { YieldBalancesCommand } from "../../../domain/schema/financial-models";
import { YieldApiService } from "../../../services/api/yield-api-service";
import { resourceInvalidationKeys } from "../../../services/resource-invalidation";
import type { WalletScopeKey } from "../../../services/wallet/domain/scope";
import { withApiResourcePolicy } from "../../../shared/effect/api-resource";
import { actionHistoryTimestampAtom } from "../../transaction-flow/state/action-history";
import { currentWalletScopeAtom } from "../../wallet/state/selectors";

const scheduledRefreshInterval = Duration.minutes(1);
const recentActionRefreshInterval = Duration.seconds(4);
const recentActionWindow = Duration.seconds(12);

const getYieldBalancesScanCommand = (
  scope: WalletScopeKey
): YieldBalancesCommand => ({
  queries: [{ address: scope.address, network: scope.network }],
});

export const yieldBalancesScanResourceAtomFamily = Atom.family(
  (scope: WalletScopeKey) =>
    appRuntime
      .atom(() =>
        Effect.gen(function* () {
          const api = yield* YieldApiService;
          return yield* api.getYieldPositions(
            getYieldBalancesScanCommand(scope)
          );
        })
      )
      .pipe(
        Atom.withReactivity(resourceInvalidationKeys.yieldPositions(scope)),
        withApiResourcePolicy({
          idleTTL: Duration.minutes(5),
          staleTime: Duration.minutes(1),
          revalidateOnMount: true,
        }),
        Atom.withLabel("yieldBalancesScanResourceAtom")
      )
);

const refreshYieldBalancesScanAtom = Atom.family((scope: WalletScopeKey) =>
  Atom.fnSync((_input: undefined, get) =>
    get.refresh(yieldBalancesScanResourceAtomFamily(scope))
  )
);

const yieldBalancesScanResourceAtom = Atom.readable((get) => {
  const scope = get(currentWalletScopeAtom);

  return scope
    ? get(yieldBalancesScanResourceAtomFamily(scope))
    : AsyncResult.success({ errors: [], items: [] });
}).pipe(Atom.withLabel("currentYieldBalancesScanResourceAtom"));

const ticksAfter = (interval: Duration.Duration) =>
  Stream.tick(interval).pipe(Stream.drop(1));

const refreshYieldBalances = <E, R>(
  get: Atom.AtomContext,
  ticks: Stream.Stream<void, E, R>
) =>
  ticks.pipe(
    Stream.tap(() =>
      Effect.sync(() => {
        const scope = get(currentWalletScopeAtom);
        if (scope) get.refresh(yieldBalancesScanResourceAtomFamily(scope));
      })
    ),
    Stream.map(() => undefined)
  );

const yieldBalancesScheduledRefreshAtom = Atom.make(
  (get) =>
    get(currentWalletScopeAtom)
      ? refreshYieldBalances(get, ticksAfter(scheduledRefreshInterval))
      : Stream.never,
  { initialValue: undefined }
).pipe(
  Atom.setIdleTTL(Duration.zero),
  Atom.withLabel("yieldBalancesScheduledRefreshAtom")
);

const yieldBalancesRecentActionRefreshAtom = Atom.make(
  (get) => {
    const scope = get(currentWalletScopeAtom);
    const lastActionTimestamp = get(actionHistoryTimestampAtom);
    if (!scope || lastActionTimestamp === null) return Stream.never;

    const recentTicks = ticksAfter(recentActionRefreshInterval).pipe(
      Stream.takeWhileEffect(() =>
        Clock.currentTimeMillis.pipe(
          Effect.map((now) =>
            Duration.isLessThan(
              Duration.millis(now - lastActionTimestamp),
              recentActionWindow
            )
          )
        )
      )
    );

    return refreshYieldBalances(get, recentTicks);
  },
  { initialValue: undefined }
).pipe(
  Atom.setIdleTTL(Duration.zero),
  Atom.withLabel("yieldBalancesRecentActionRefreshAtom")
);

export const yieldBalancesScanAtom = Atom.writable(
  (get) => {
    get(yieldBalancesScheduledRefreshAtom);
    get(yieldBalancesRecentActionRefreshAtom);

    return {
      enabled: get(currentWalletScopeAtom) !== null,
      result: get(yieldBalancesScanResourceAtom),
    } as const;
  },
  (get) => {
    const scope = get.get(currentWalletScopeAtom);
    if (scope) get.set(refreshYieldBalancesScanAtom(scope), undefined);
  }
).pipe(Atom.withLabel("yieldBalancesScanAtom"));
