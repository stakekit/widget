import { useAtomValue } from "@effect/atom-react";
import { Effect, Option, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { Config } from "wagmi";
import { appRuntime } from "../../../app/runtime";
import { WalletRuntimeTerminalError } from "../../../services/wallet/domain/errors";
import {
  bootstrappingWalletRuntimeSnapshot,
  type WalletProjection,
  type WalletRuntimeSnapshot,
} from "../../../services/wallet/domain/runtime";
import {
  disconnectedLedgerConnectorState,
  disconnectedNormalizedWalletState,
} from "../../../services/wallet/domain/state";
import { WalletService } from "../../../services/wallet/wallet-service";

const walletRuntimeSnapshotAtom = appRuntime
  .atom(
    WalletService.use((wallet) => Effect.succeed(wallet.changes)).pipe(
      Stream.unwrap
    ),
    {
      initialValue: bootstrappingWalletRuntimeSnapshot,
    }
  )
  .pipe(Atom.setIdleTTL(0), Atom.withLabel("walletRuntimeSnapshotAtom"));

const projectWalletRuntime = <A, E>(
  result: AsyncResult.AsyncResult<WalletRuntimeSnapshot, E>,
  fallback: A,
  project: (projection: WalletProjection) => A
): AsyncResult.AsyncResult<A, E | WalletRuntimeTerminalError> => {
  const projected = result.pipe(
    AsyncResult.map((snapshot) =>
      snapshot.projection === null ? fallback : project(snapshot.projection)
    )
  );

  if (result._tag !== "Success") return projected;
  if (
    result.value.phase === "BootstrapFailed" ||
    result.value.phase === "InvariantViolated"
  ) {
    return AsyncResult.fail(
      new WalletRuntimeTerminalError({
        cause: result.value.cause,
        phase: result.value.phase,
      })
    );
  }

  return projected;
};

export const currentWalletStateResultAtom = Atom.make((get) =>
  projectWalletRuntime(
    get(walletRuntimeSnapshotAtom),
    disconnectedNormalizedWalletState,
    (projection) => projection.state
  )
).pipe(Atom.withLabel("currentWalletStateResultAtom"));

export const currentWalletLedgerStateAtom = Atom.make((get) =>
  projectWalletRuntime(
    get(walletRuntimeSnapshotAtom),
    disconnectedLedgerConnectorState,
    (projection) => projection.ledgerState
  )
).pipe(Atom.withLabel("currentWalletLedgerStateAtom"));

const projectWalletRuntimeConfig = <E>(
  result: AsyncResult.AsyncResult<WalletRuntimeSnapshot, E>
): AsyncResult.AsyncResult<Config | null, E | WalletRuntimeTerminalError> => {
  const projected = result.pipe(
    AsyncResult.map((snapshot) => snapshot.wagmiConfig)
  );

  if (result._tag !== "Success") return projected;
  if (
    result.value.phase === "BootstrapFailed" ||
    result.value.phase === "InvariantViolated"
  ) {
    return AsyncResult.fail(
      new WalletRuntimeTerminalError({
        cause: result.value.cause,
        phase: result.value.phase,
      })
    );
  }

  return projected;
};

export const currentWalletRuntimeConfigResultAtom = Atom.make((get) =>
  projectWalletRuntimeConfig(get(walletRuntimeSnapshotAtom))
).pipe(Atom.withLabel("currentWalletRuntimeConfigResultAtom"));

type WalletRuntimeConfigResource = {
  readonly data: Config | undefined;
  readonly error: unknown;
  readonly isLoading: boolean;
};

const walletRuntimeConfigAtom = Atom.make((get) => {
  const result = get(currentWalletRuntimeConfigResultAtom);
  const data = result.pipe(AsyncResult.value, Option.getOrUndefined);

  return {
    data: data ?? undefined,
    error: result.pipe(AsyncResult.error, Option.getOrUndefined),
    isLoading: AsyncResult.isInitial(result) || data === null,
  } satisfies WalletRuntimeConfigResource;
}).pipe(Atom.withLabel("walletRuntimeConfigAtom"));

export const useWalletRuntimeConfig = (): WalletRuntimeConfigResource =>
  useAtomValue(walletRuntimeConfigAtom);
