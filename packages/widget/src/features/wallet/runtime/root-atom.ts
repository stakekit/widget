import { useAtomValue } from "@effect/atom-react";
import { Option, type Schema } from "effect";
import type * as KeyValueStore from "effect/unstable/persistence/KeyValueStore";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { dynamicExternalProviderInputAtom } from "../../../app/runtime";
import type { AdditionalAddresses } from "../../../domain/schema/address-models";
import type { WalletController } from "../../../services/wallet/wagmi-config";
import {
  type AdditionalAddressesError,
  makeAdditionalAddressesAtom,
} from "../state/additional-addresses";
import { makeWalletConnectionAtom } from "../state/connection";
import { makeConnectorChainsAtom } from "../state/connector-chains";
import { makeWalletConnectorsAtom } from "../state/connectors";
import { makeCosmosChainWalletAtom } from "../state/cosmos";
import { makeLedgerConnectorStateAtom } from "../state/ledger";
import { makeWalletStateAtom } from "../state/wallet";
import { walletControllerAtom } from "../wagmi/controller";
import {
  type WalletInitializationKey,
  walletInitializationKeyAtom,
} from "../wagmi/initialization";
import { makeWalletServiceBindingAtom } from "./binding-atom";
import { makeExternalProviderSyncAtom } from "./external-provider-sync";
import { makeWalletLifecycleAtom } from "./lifecycle";

const walletConnectionAtom = Atom.family((key: WalletInitializationKey) =>
  makeWalletConnectionAtom(walletControllerAtom(key))
);

const walletConnectorsAtom = Atom.family((key: WalletInitializationKey) =>
  makeWalletConnectorsAtom(walletControllerAtom(key))
);

const walletExternalProviderSyncAtom = Atom.family(
  (key: WalletInitializationKey) =>
    makeExternalProviderSyncAtom(
      walletControllerAtom(key),
      walletConnectorsAtom(key),
      walletConnectionAtom(key),
      dynamicExternalProviderInputAtom
    )
);

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

  get(walletExternalProviderSyncAtom(initializationKey));
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
