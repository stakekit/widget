import { Duration, Effect, Stream } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime";
import type { TokenBalanceScanCommand } from "../../../domain/schema/financial-models";
import { selectCurrentWalletAtom } from "../../../features/wallet";
import { LegacyApiService } from "../../../services/api/legacy-api-service";
import { withApiResourcePolicy } from "../../../shared/effect/api-resource";

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

export const tokenBalancesScanResourceAtom = appRuntime
  .atom((get) =>
    Effect.gen(function* () {
      const command = get(tokenBalancesScanCommandAtom);
      if (!command) return null;

      const api = yield* LegacyApiService;
      return yield* api.scanTokenBalances(command);
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
