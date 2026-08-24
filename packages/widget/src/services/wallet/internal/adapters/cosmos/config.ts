import type { Chain, WalletList } from "@stakekit/rainbowkit";
import { Effect, Record } from "effect";
import type { WalletAddress } from "../../../../../domain/identity/identifiers";
import type { Network } from "../../../../../domain/network/network";
import { walletCosmosNetworks } from "../../../../../domain/wallet/network";
import { WalletIntegrationError } from "../../../wallet-errors";
import type { CosmosChainsMap } from "./chains";
import { getWagmiChain } from "./chains/index";

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
  forceWalletConnectOnly,
  persistPublicKey,
}: {
  cosmosChainsMap: Partial<CosmosChainsMap>;
  forceWalletConnectOnly: boolean;
  persistPublicKey: (input: {
    readonly address: WalletAddress;
    readonly publicKey: string;
  }) => Promise<void>;
}) {
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
        forceWalletConnectOnly,
        persistPublicKey,
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

  yield* Effect.matchEffect(
    Effect.tryPromise({
      try: () => walletManager.onMounted(),
      catch: (error) => error,
    }),
    {
      onFailure: () => {
        const restorableWalletManager = walletManager as unknown as {
          _restoreAccounts: () => Promise<void>;
        };

        return Effect.tryPromise({
          try: () => restorableWalletManager._restoreAccounts(),
          catch: (error) => error,
        }).pipe(Effect.ignore);
      },
      onSuccess: () => Effect.void,
    }
  );

  return connector;
});

const queryFn = ({
  buildConnectors,
  enabledNetworks,
  forceWalletConnectOnly,
  persistPublicKey,
}: {
  buildConnectors: boolean;
  enabledNetworks: ReadonlySet<Network>;
  forceWalletConnectOnly: boolean;
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

    const cosmosChainsMap: Partial<CosmosChainsMap> = Record.filter(
      registry.cosmosRegistryChains.reduce((acc, next) => {
        const network = registry.registryIdsToSKCosmosNetworks[next.chain_id];

        if (!network || !chainsToUseSet.has(network)) {
          return acc;
        }

        return {
          // biome-ignore lint: false
          ...acc,
          [network]: {
            type: "cosmos",
            network,
            chain: next,
            wagmiChain: getWagmiChain(next),
          },
        };
      }, {} as CosmosChainsMap),
      (v) => networks.has(v.network)
    );

    const cosmosWagmiChains = Object.values(cosmosChainsMap).map(
      (value) => value.wagmiChain
    );

    if (!buildConnectors) {
      return { cosmosChainsMap, cosmosWagmiChains, connector: null };
    }

    const connector = yield* loadCosmosConnector({
      cosmosChainsMap,
      forceWalletConnectOnly,
      persistPublicKey,
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
