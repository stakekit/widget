import { useAtomValue } from "@effect/atom-react";
import { Effect, Option, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
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
import type { WalletController } from "../../../services/wallet/wagmi-config";
import { WalletService } from "../../../services/wallet/wallet-service";
import { disconnectedWalletConnection } from "../state/connection";
import { disconnectedWalletConnectors } from "../state/connectors";
import { walletControllerAtom } from "../wagmi/controller";
import {
  type WalletInitializationKey,
  walletInitializationKeyAtom,
} from "../wagmi/initialization";
import { makeWalletLifecycleAtom } from "./lifecycle";

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

export const currentWalletConnectionResultAtom = Atom.make((get) =>
  projectWalletRuntime(
    get(walletRuntimeSnapshotAtom),
    disconnectedWalletConnection,
    (projection) => projection.connection
  )
).pipe(Atom.withLabel("currentWalletConnectionResultAtom"));

export const currentWalletConnectorsResultAtom = Atom.make((get) =>
  projectWalletRuntime(
    get(walletRuntimeSnapshotAtom),
    disconnectedWalletConnectors,
    (projection) => projection.connectors
  )
).pipe(Atom.withLabel("currentWalletConnectorsResultAtom"));

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

export const walletStateAtom = (_key: WalletInitializationKey) =>
  currentWalletStateResultAtom;

export const walletLedgerStateAtom = (_key: WalletInitializationKey) =>
  currentWalletLedgerStateAtom;

const walletLifecycleAtom = Atom.family((key: WalletInitializationKey) =>
  makeWalletLifecycleAtom(walletControllerAtom(key), walletStateAtom(key))
);

type WalletControllerResource = {
  readonly data: WalletController | undefined;
  readonly error: unknown;
  readonly initializationKey: WalletInitializationKey;
  readonly isLoading: boolean;
};

const walletRootAtom = Atom.make((get) => {
  const initializationKey = get(walletInitializationKeyAtom);
  const result = get(walletControllerAtom(initializationKey));

  get(walletLifecycleAtom(initializationKey));

  return {
    data: result.pipe(AsyncResult.value, Option.getOrUndefined),
    error: result.pipe(AsyncResult.error, Option.getOrUndefined),
    initializationKey,
    isLoading: AsyncResult.isInitial(result),
  } satisfies WalletControllerResource;
}).pipe(Atom.withLabel("walletRootAtom"));

export const useWalletController = (): WalletControllerResource =>
  useAtomValue(walletRootAtom);
