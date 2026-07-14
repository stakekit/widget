import { Clock, Data, Duration, Effect, Stream } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { withApiResourcePolicy } from "../../atoms/api-resource";
import type { YieldBalancesCommand } from "../../domain/schema/financial-models";
import { StakeKitApiService } from "../../providers/api/api-service";
import { widgetAtomRuntime } from "../../providers/effect-atom-runtime/widget-runtime";
import { actionHistoryTimestampAtom } from "../../providers/stake-history";
import { selectCurrentWalletAtom } from "../../providers/wallet";

export class YieldBalancesKey extends Data.Class<{
  readonly command: YieldBalancesCommand | null;
  readonly enabled: boolean;
}> {}

export const yieldBalancesAtom = Atom.family((key: YieldBalancesKey) =>
  widgetAtomRuntime
    .atom(() =>
      Effect.gen(function* () {
        if (!key.enabled || !key.command) return null;

        const api = yield* StakeKitApiService;
        return yield* api.yield.getYieldPositions(key.command);
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
const recentActionRefreshInterval = Duration.seconds(4);
const recentActionWindow = Duration.seconds(12);

const yieldBalancesScanCommandAtom = selectCurrentWalletAtom((walletState) => {
  if (!walletState.address || !walletState.network) return null;

  return {
    queries: [{ address: walletState.address, network: walletState.network }],
  } satisfies YieldBalancesCommand;
}).pipe(Atom.withLabel("yieldBalancesScanCommandAtom"));

const yieldBalancesScanResourceAtom = widgetAtomRuntime
  .atom((get) =>
    Effect.gen(function* () {
      const command = get(yieldBalancesScanCommandAtom);
      if (!command) return null;

      const api = yield* StakeKitApiService;
      return yield* api.yield.getYieldPositions(command);
    })
  )
  .pipe(
    withApiResourcePolicy({
      idleTTL: Duration.minutes(5),
      staleTime: Duration.minutes(1),
      revalidateOnMount: true,
    }),
    Atom.withLabel("yieldBalancesScanResourceAtom")
  );

const ticksAfter = (interval: Duration.Duration) =>
  Stream.tick(interval).pipe(Stream.drop(1));

const refreshYieldBalances = <E, R>(
  get: Atom.AtomContext,
  ticks: Stream.Stream<void, E, R>
) =>
  ticks.pipe(
    Stream.tap(() =>
      Effect.sync(() => get.refresh(yieldBalancesScanResourceAtom))
    ),
    Stream.map(() => undefined)
  );

const yieldBalancesScheduledRefreshAtom = Atom.make(
  (get) =>
    get(yieldBalancesScanCommandAtom)
      ? refreshYieldBalances(get, ticksAfter(scheduledRefreshInterval))
      : Stream.never,
  { initialValue: undefined }
).pipe(
  Atom.setIdleTTL(Duration.zero),
  Atom.withLabel("yieldBalancesScheduledRefreshAtom")
);

const yieldBalancesRecentActionRefreshAtom = Atom.make(
  (get) => {
    const command = get(yieldBalancesScanCommandAtom);
    const lastActionTimestamp = get(actionHistoryTimestampAtom);
    if (!command || lastActionTimestamp === null) return Stream.never;

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

export const yieldBalancesScanAtom = Atom.readable(
  (get) => {
    get(yieldBalancesScheduledRefreshAtom);
    get(yieldBalancesRecentActionRefreshAtom);

    return {
      enabled: get(yieldBalancesScanCommandAtom) !== null,
      result: get(yieldBalancesScanResourceAtom),
    } as const;
  },
  (refresh) => refresh(yieldBalancesScanResourceAtom)
).pipe(Atom.withLabel("yieldBalancesScanAtom"));
