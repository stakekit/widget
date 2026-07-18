import { useAtomValue } from "@effect/atom-react";
import { Effect, Option, type Schema, Stream } from "effect";
import type * as KeyValueStore from "effect/unstable/persistence/KeyValueStore";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime";
import type { AdditionalAddresses } from "../../../domain/schema/address-models";
import { WalletRuntimeTerminalError } from "../../../services/wallet/domain/errors";
import {
  bootstrappingWalletRuntimeSnapshot,
  type WalletCoreProjection,
  type WalletRuntimeSnapshot,
} from "../../../services/wallet/domain/runtime";
import type { WalletController } from "../../../services/wallet/wagmi-config";
import { WalletService } from "../../../services/wallet/wallet-service";
import {
  type AdditionalAddressesError,
  makeAdditionalAddressesAtom,
} from "../state/additional-addresses";
import { disconnectedWalletConnection } from "../state/connection";
import { makeConnectorChainsAtom } from "../state/connector-chains";
import { disconnectedWalletConnectors } from "../state/connectors";
import { makeCosmosChainWalletAtom } from "../state/cosmos";
import { makeLedgerConnectorStateAtom } from "../state/ledger";
import { makeWalletStateAtom } from "../state/wallet";
import { walletControllerAtom } from "../wagmi/controller";
import {
  type WalletInitializationKey,
  walletInitializationKeyAtom,
} from "../wagmi/initialization";
import { makeWalletServiceBindingAtom } from "./binding-atom";
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
  project: (projection: WalletCoreProjection) => A
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

const walletConnectionAtom = (_key: WalletInitializationKey) =>
  currentWalletConnectionResultAtom;

const walletConnectorChainsAtom = Atom.family((key: WalletInitializationKey) =>
  makeConnectorChainsAtom(walletControllerAtom(key), walletConnectionAtom(key))
);

export const walletLedgerStateAtom = Atom.family(
  (key: WalletInitializationKey) =>
    makeLedgerConnectorStateAtom(walletConnectionAtom(key))
);

const walletCosmosChainWalletAtom = Atom.family(
  (key: WalletInitializationKey) =>
    makeCosmosChainWalletAtom(walletConnectionAtom(key))
);

const walletAdditionalAddressesAtom = Atom.family(
  (
    key: WalletInitializationKey
  ): Atom.Atom<
    AsyncResult.AsyncResult<
      AdditionalAddresses | null,
      | AdditionalAddressesError
      | Atom.Failure<ReturnType<typeof walletConnectionAtom>>
      | Atom.Failure<ReturnType<typeof walletCosmosChainWalletAtom>>
      | KeyValueStore.KeyValueStoreError
      | Schema.SchemaError
    >
  > =>
    makeAdditionalAddressesAtom(
      walletConnectionAtom(key),
      walletCosmosChainWalletAtom(key)
    )
);

export const walletStateAtom = Atom.family((key: WalletInitializationKey) =>
  makeWalletStateAtom(
    walletControllerAtom(key),
    walletConnectionAtom(key),
    walletConnectorChainsAtom(key),
    walletLedgerStateAtom(key),
    walletAdditionalAddressesAtom(key)
  )
);

export const currentWalletStateResultAtom = Atom.make((get) =>
  get(walletStateAtom(get(walletInitializationKeyAtom)))
).pipe(Atom.withLabel("currentWalletStateResultAtom"));

export const currentWalletLedgerStateAtom = Atom.make((get) =>
  get(walletLedgerStateAtom(get(walletInitializationKeyAtom)))
).pipe(Atom.withLabel("currentWalletLedgerStateAtom"));

const walletServiceBindingAtom = Atom.family((key: WalletInitializationKey) =>
  makeWalletServiceBindingAtom(
    walletControllerAtom(key),
    walletStateAtom(key),
    walletLedgerStateAtom(key),
    walletCosmosChainWalletAtom(key)
  )
);

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
  get(walletServiceBindingAtom(initializationKey));

  return {
    data: result.pipe(AsyncResult.value, Option.getOrUndefined),
    error: result.pipe(AsyncResult.error, Option.getOrUndefined),
    initializationKey,
    isLoading: AsyncResult.isInitial(result),
  } satisfies WalletControllerResource;
}).pipe(Atom.withLabel("walletRootAtom"));

export const useWalletController = (): WalletControllerResource =>
  useAtomValue(walletRootAtom);
