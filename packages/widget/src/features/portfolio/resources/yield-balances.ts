import { Clock, Duration, Effect, Stream } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime";
import type { YieldBalancesCommand } from "../../../domain/schema/financial-models";
import { actionHistoryTimestampAtom } from "../../../features/transaction-flow";
import { selectCurrentWalletAtom } from "../../../features/wallet";
import { YieldApiService } from "../../../services/api/yield-api-service";
import { withApiResourcePolicy } from "../../../shared/effect/api-resource";

const scheduledRefreshInterval = Duration.minutes(1);
const recentActionRefreshInterval = Duration.seconds(4);
const recentActionWindow = Duration.seconds(12);

const yieldBalancesScanCommandAtom = selectCurrentWalletAtom((walletState) => {
  if (!walletState.address || !walletState.network) return null;

  return {
    queries: [{ address: walletState.address, network: walletState.network }],
  } satisfies YieldBalancesCommand;
}).pipe(Atom.withLabel("yieldBalancesScanCommandAtom"));

export const yieldBalancesScanResourceAtom = appRuntime
  .atom((get) =>
    Effect.gen(function* () {
      const command = get(yieldBalancesScanCommandAtom);
      if (!command) return null;

      const api = yield* YieldApiService;
      return yield* api.getYieldPositions(command);
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
