import { WalletConnectWallet } from "./wallet-connect";
import { Logger, MainWalletBase, WalletManager } from "@cosmos-kit/core";
import { config } from "../../config";
import { typeSafeObjectEntries, typeSafeObjectFromEntries } from "../../utils";
import { cosmosAssets } from "./chains/chain-registry";
import {
  CosmosChainsMap,
  supportedCosmosChains,
} from "../../domain/types/chains";
import {
  filteredCosmosChains,
  getWagmiChain,
  sKCosmosNetworksToRegistryIds,
} from "./chains";
import { getEnabledNetworks } from "../api/get-enabled-networks";
import { EitherAsync, Maybe } from "purify-ts";
import { QueryClient } from "@tanstack/react-query";
import { createCosmosConnector, wallets } from "./cosmos-connector";
import { WalletList } from "@stakekit/rainbowkit";
import { useYieldGetMyNetworksHook } from "@stakekit/api-hooks";

const queryKey = [config.appPrefix, "cosmos-config"];
const staleTime = Infinity;

const queryFn = async ({
  queryClient,
  forceWalletConnectOnly,
  yieldGetMyNetworks,
}: {
  queryClient: QueryClient;
  yieldGetMyNetworks: ReturnType<typeof useYieldGetMyNetworksHook>;
  forceWalletConnectOnly: boolean;
}) =>
  getEnabledNetworks({ queryClient, yieldGetMyNetworks })
    .chain((networks) => {
      const cosmosChainsMap: Partial<CosmosChainsMap> =
        typeSafeObjectFromEntries(
          typeSafeObjectEntries<CosmosChainsMap>(
            supportedCosmosChains.reduce((acc, next) => {
              const chain =
                filteredCosmosChains[sKCosmosNetworksToRegistryIds[next]];

              if (!chain) {
                throw new Error("Chain not found");
              }

              return {
                ...acc,
                [next]: {
                  type: "cosmos",
                  skChainName: next,
                  chain,
                  wagmiChain: getWagmiChain(chain),
                },
              };
            }, {} as CosmosChainsMap)
          ).filter(([_, v]) => networks.has(v.skChainName))
        );

      const cosmosWagmiChains = Object.values(cosmosChainsMap).map(
        (val) => val.wagmiChain
      );

      const filteredWallets: MainWalletBase[] = forceWalletConnectOnly
        ? wallets.filter((w) => w instanceof WalletConnectWallet)
        : wallets;

      const connector: WalletList[number] = {
        groupName: "Cosmos",
        wallets: filteredWallets.map(
          (w) => () =>
            createCosmosConnector({
              wallet: w,
              cosmosChainsMap,
              cosmosWagmiChains,
            })
        ),
      };

      const cosmosWalletManager = new WalletManager(
        Object.values(cosmosChainsMap).map((c) => c.chain),
        filteredWallets,
        new Logger("ERROR"),
        false,
        true,
        undefined,
        cosmosAssets,
        undefined,
        {
          signClient: {
            projectId: config.walletConnectV2.projectId,
            customStoragePrefix: "cosmoswalletconnect_",
          },
        }
      );

      return EitherAsync(() => {
        return cosmosWalletManager.onMounted();
      })
        .chainLeft((e) => {
          return EitherAsync(() => {
            // @ts-expect-error
            return cosmosWalletManager._restoreAccounts().catch(() => {});
          });
        })
        .mapLeft((e) => {
          console.log(e);
          return new Error("cosmosWalletManager onMounted failed");
        })
        .map(() => ({
          cosmosChainsMap,
          cosmosWagmiChains,
          connector: Maybe.fromPredicate(
            () => !!cosmosWagmiChains.length,
            connector
          ),
        }));
    })
    .caseOf({
      Right: (val) => Promise.resolve(val),
      Left: (l) => Promise.reject(l),
    });

export const getConfig = (opts: Parameters<typeof queryFn>[0]) =>
  EitherAsync(() =>
    opts.queryClient.fetchQuery({
      staleTime,
      queryKey,
      queryFn: () => queryFn(opts),
    })
  ).mapLeft((e) => {
    console.log(e);
    return new Error("Could not get cosmos config");
  });
