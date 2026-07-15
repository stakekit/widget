import type { Chain, WalletList } from "@stakekit/rainbowkit";
import { Effect } from "effect";
import type { WalletAddress } from "../../../../domain/schema/identifiers";
import type { Network } from "../../../../domain/schema/network-model";
import type { CosmosChainsMap } from "../../../../domain/types/chains/cosmos";
import { supportedCosmosChains } from "../../../../domain/types/chains/cosmos";

import {
  typeSafeObjectEntries,
  typeSafeObjectFromEntries,
} from "../../../../shared/lib/object";
import { getWagmiChain } from "./chains";

const queryFn = ({
  enabledNetworks,
  forceWalletConnectOnly,
  persistPublicKey,
}: {
  enabledNetworks: ReadonlySet<Network>;
  forceWalletConnectOnly: boolean;
  persistPublicKey: (input: {
    readonly address: WalletAddress;
    readonly publicKey: string;
  }) => Promise<void>;
}) =>
  Effect.gen(function* () {
    const networks = enabledNetworks;
    const chainsToUse = supportedCosmosChains.filter((chain) =>
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
      catch: (error) =>
        new Error("Could not import cosmos chain registry", { cause: error }),
    });
    const chainsToUseSet = new Set(chainsToUse);

    const cosmosChainsMap: Partial<CosmosChainsMap> = typeSafeObjectFromEntries(
      typeSafeObjectEntries<CosmosChainsMap>(
        registry.cosmosRegistryChains.reduce((acc, next) => {
          const skChainName =
            registry.registryIdsToSKCosmosNetworks[next.chain_id];

          if (!skChainName || !chainsToUseSet.has(skChainName)) {
            return acc;
          }

          return {
            // biome-ignore lint: false
            ...acc,
            [skChainName]: {
              type: "cosmos",
              skChainName,
              chain: next,
              wagmiChain: getWagmiChain(next),
            },
          };
        }, {} as CosmosChainsMap)
      ).filter(([_, v]) => networks.has(v.skChainName))
    );

    const cosmosWagmiChains = Object.values(cosmosChainsMap).map(
      (value) => value.wagmiChain
    );
    const walletManagerModule = yield* Effect.tryPromise({
      try: () => import("./wallet-manager"),
      catch: (error) =>
        new Error("Could not import cosmos wallet manager", { cause: error }),
    });
    const { connector, walletManager } = yield* Effect.try({
      try: () =>
        walletManagerModule.getWalletManager({
          cosmosChainsMap,
          forceWalletConnectOnly,
          persistPublicKey,
        }),
      catch: (error) =>
        new Error("Could not initialize cosmos wallet manager", {
          cause: error,
        }),
    });

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

    return {
      cosmosChainsMap,
      cosmosWagmiChains,
      connector: cosmosWagmiChains.length ? connector : null,
    };
  });

export const getConfig = (opts: Parameters<typeof queryFn>[0]) =>
  queryFn(opts).pipe(
    Effect.mapError(
      (error) => new Error("Could not get cosmos config", { cause: error })
    )
  );
