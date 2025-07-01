import type { Chain, WalletList } from "@stakekit/rainbowkit";
import type { QueryClient } from "@tanstack/react-query";
import { EitherAsync, Maybe, Right } from "purify-ts";
import { config } from "../../config";
import type { CosmosChainsMap } from "../../domain/types/chains/cosmos";
import { supportedCosmosChains } from "../../domain/types/chains/cosmos";
import { typeSafeObjectEntries, typeSafeObjectFromEntries } from "../../utils";
import { getEnabledNetworks } from "../api/get-enabled-networks";
import { getWagmiChain } from "./chains";

const queryKey = [config.appPrefix, "cosmos-config"];
const staleTime = Number.POSITIVE_INFINITY;

const queryFn = async ({
  queryClient,
  forceWalletConnectOnly,
}: {
  queryClient: QueryClient;
  forceWalletConnectOnly: boolean;
}) =>
  getEnabledNetworks({ queryClient })
    .chain<
      Error,
      {
        cosmosChainsMap: Partial<CosmosChainsMap>;
        cosmosWagmiChains: Chain[];
        connector: Maybe<WalletList[number]>;
      }
    >((networks) => {
      const chainsToUse = supportedCosmosChains.filter((chain) =>
        networks.has(chain)
      );

      if (!chainsToUse.length) {
        return EitherAsync.liftEither(
          Right({
            cosmosChainsMap: {},
            cosmosWagmiChains: [],
            connector: Maybe.empty(),
          })
        );
      }

      return EitherAsync(() => import("./chains/chain-registry"))
        .mapLeft(() => new Error("Could not import cosmos chain registry"))
        .map((v) => {
          const chainsToUseSet = new Set(chainsToUse);

          const cosmosChainsMap: Partial<CosmosChainsMap> =
            typeSafeObjectFromEntries(
              typeSafeObjectEntries<CosmosChainsMap>(
                v.cosmosRegistryChains.reduce((acc, next) => {
                  const skChainName =
                    v.registryIdsToSKCosmosNetworks[next.chain_id];

                  if (!skChainName || !chainsToUseSet.has(skChainName)) {
                    return acc;
                  }

                  return {
                    // biome-ignore lint/performance/noAccumulatingSpread: <explanation>
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

          return {
            cosmosChainsMap,
            cosmosWagmiChains: Object.values(cosmosChainsMap).map(
              (val) => val.wagmiChain
            ),
          };
        })
        .chain(({ cosmosChainsMap, cosmosWagmiChains }) =>
          EitherAsync(() => import("./wallet-manager"))
            .mapLeft(() => new Error("Could not import cosmos wallet manager"))
            .map((v) =>
              v.getWalletManager({ cosmosChainsMap, forceWalletConnectOnly })
            )
            .map((val) => ({ ...val, cosmosWagmiChains, cosmosChainsMap }))
        )
        .chain((v) =>
          EitherAsync(() => v.walletManager.onMounted())
            .chainLeft(() =>
              EitherAsync(() => {
                // @ts-expect-error
                return cosmosWalletManager._restoreAccounts().catch(() => {});
              })
            )
            .mapLeft((e) => {
              console.log(e);
              return new Error("cosmosWalletManager onMounted failed");
            })

            .map(() => ({
              cosmosChainsMap: v.cosmosChainsMap,
              cosmosWagmiChains: v.cosmosWagmiChains,
              connector: Maybe.fromPredicate(
                () => !!v.cosmosWagmiChains.length,
                v.connector
              ),
            }))
        );
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
