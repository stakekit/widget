import { Effect } from "effect";
import type { WalletAddress } from "../../../../../domain/identity/identifiers";
import type { Network } from "../../../../../domain/network/network";
import {
  type WalletCosmosNetwork,
  walletCosmosNetworks,
} from "../../../../../domain/wallet/network";
import type { Chain, WalletList } from "../../../wallet-descriptors";
import { WalletIntegrationError } from "../../../wallet-errors";
import type { WalletConnectProtocol } from "../../platform/wallet-connect-protocol";
import type { RunWalletEffect } from "../../runtime/effect-runner";
import type {
  CosmosChainEntry,
  CosmosChainsAssets,
  CosmosChainsMap,
} from "./chains";
import { getWagmiChain } from "./chains/index";
import type { CosmosWalletManagerOptions } from "./wallet-manager";

const logCosmosConnectorFailure = (operation: string, cause: unknown) =>
  Effect.logError("Cosmos wallet connector failed to load").pipe(
    Effect.annotateLogs({
      cause,
      event: "cosmos_wallet_connector_failed",
      operation,
    })
  );

const loadCosmosConnector = Effect.fn("loadCosmosConnector")(function* ({
  cosmosChainsMap,
  persistPublicKey,
  walletConnectProtocol,
  runWalletEffect,
}: CosmosWalletManagerOptions) {
  const walletManagerModule = yield* Effect.tryPromise({
    try: () => import("./wallet-manager"),
    catch: (cause) =>
      new WalletIntegrationError({
        cause,
        message: "Could not import cosmos wallet manager",
        operation: "cosmos-wallet-manager-import",
      }),
  }).pipe(
    Effect.catch((error) =>
      logCosmosConnectorFailure("cosmos-wallet-manager-import", error).pipe(
        Effect.as(null)
      )
    )
  );
  if (!walletManagerModule) {
    return null;
  }

  const initialized = yield* Effect.try({
    try: () =>
      walletManagerModule.getWalletManager({
        cosmosChainsMap,
        persistPublicKey,
        walletConnectProtocol,
        runWalletEffect,
      }),
    catch: (cause) =>
      new WalletIntegrationError({
        cause,
        message: "Could not initialize cosmos wallet manager",
        operation: "cosmos-wallet-manager-initialize",
      }),
  }).pipe(
    Effect.catch((error) =>
      logCosmosConnectorFailure("cosmos-wallet-manager-initialize", error).pipe(
        Effect.as(null)
      )
    )
  );
  if (!initialized) {
    return null;
  }

  const { connector, walletManager } = initialized;
  yield* Effect.addFinalizer(() =>
    Effect.sync(() => walletManager.onUnmounted())
  );

  yield* Effect.matchEffect(
    Effect.tryPromise(() => walletManager.onMounted()),
    {
      onFailure: () => {
        // biome-ignore lint/nursery/noUnsafeTypeAssertion: @cosmos-kit/core declares _restoreAccounts private and untyped; it is the only restore path after a failed mount
        const restorableWalletManager = walletManager as unknown as {
          _restoreAccounts: () => Promise<void>;
        };

        return Effect.tryPromise(() =>
          restorableWalletManager._restoreAccounts()
        ).pipe(Effect.ignore);
      },
      onSuccess: () => Effect.void,
    }
  );

  return connector;
});

const makeCosmosChainEntry = <Key extends WalletCosmosNetwork>(
  network: Key,
  chain: CosmosChainsAssets
): CosmosChainEntry<Key> => ({
  type: "cosmos",
  network,
  chain,
  wagmiChain: getWagmiChain(chain),
});

const setCosmosChainEntry = <Key extends WalletCosmosNetwork>(
  map: { [Network in Key]?: CosmosChainEntry<Network> },
  entry: CosmosChainEntry<Key>
) => {
  map[entry.network] = entry;
};

const queryFn = ({
  buildConnectors,
  enabledNetworks,
  persistPublicKey,
  walletConnectProtocol,
  runWalletEffect,
}: {
  buildConnectors: boolean;
  enabledNetworks: ReadonlySet<Network>;
  walletConnectProtocol: WalletConnectProtocol;
  runWalletEffect: RunWalletEffect;
  persistPublicKey: (input: {
    readonly address: WalletAddress;
    readonly publicKey: string;
  }) => Promise<void>;
}) =>
  Effect.gen(function* () {
    const networks = enabledNetworks;
    const chainsToUse = walletCosmosNetworks.filter((chain) =>
      networks.has(chain)
    );

    if (!chainsToUse.length) {
      return {
        cosmosChainsMap: {},
        cosmosWagmiChains: [],
        connector: null,
      } satisfies {
        cosmosChainsMap: Partial<CosmosChainsMap>;
        cosmosWagmiChains: Chain[];
        connector: WalletList[number] | null;
      };
    }

    const registry = yield* Effect.tryPromise({
      try: () => import("./chains/chain-registry"),
      catch: (cause) =>
        new WalletIntegrationError({
          cause,
          message: "Could not import cosmos chain registry",
          operation: "cosmos-chain-registry-import",
        }),
    });
    const chainsToUseSet = new Set(chainsToUse);

    const cosmosChainsMap: Partial<CosmosChainsMap> = {};
    for (const next of registry.cosmosRegistryChains) {
      const network = registry.registryIdsToSKCosmosNetworks[next.chain_id];
      if (network && chainsToUseSet.has(network)) {
        setCosmosChainEntry(
          cosmosChainsMap,
          makeCosmosChainEntry(network, next)
        );
      }
    }

    const cosmosWagmiChains = Object.values(cosmosChainsMap).map(
      (value) => value.wagmiChain
    );

    if (!buildConnectors) {
      return { cosmosChainsMap, cosmosWagmiChains, connector: null };
    }

    const connector = yield* loadCosmosConnector({
      cosmosChainsMap,
      persistPublicKey,
      walletConnectProtocol,
      runWalletEffect,
    });

    return {
      cosmosChainsMap,
      cosmosWagmiChains,
      connector: cosmosWagmiChains.length ? connector : null,
    };
  });

export const getConfig = (opts: Parameters<typeof queryFn>[0]) =>
  queryFn(opts).pipe(
    Effect.mapError(
      (cause) =>
        new WalletIntegrationError({
          cause,
          message: "Could not get cosmos config",
          operation: "cosmos-config",
        })
    )
  );
