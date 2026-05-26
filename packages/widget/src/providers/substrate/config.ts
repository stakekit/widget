import type { Chain as LunoKitChain } from "@luno-kit/core/chains";
import type { Chain, WalletList } from "@stakekit/rainbowkit";
import type { QueryClient } from "@tanstack/react-query";
import { EitherAsync, Maybe } from "purify-ts";
import { getEnabledNetworks } from "../../common/get-enabled-networks";
import { config } from "../../config";
import {
  type SubstrateChainsMap,
  substrateChainsMap,
} from "../../domain/types/chains/substrate";
import {
  getNetworkLogo,
  typeSafeObjectEntries,
  typeSafeObjectFromEntries,
} from "../../utils";
import type { ApiClient } from "../api/api-client";

const queryKey = [config.appPrefix, "substrate-config"];
const staleTime = Number.POSITIVE_INFINITY;

const queryFn = async ({
  apiClient,
  queryClient,
  forceWalletConnectOnly,
}: {
  apiClient: ApiClient;
  queryClient: QueryClient;
  forceWalletConnectOnly: boolean;
}): Promise<{
  substrateChainsMap: Partial<SubstrateChainsMap>;
  substrateChains: Chain[];
  connector: Maybe<{
    groupName: string;
    wallets: WalletList[number]["wallets"];
  }>;
}> =>
  getEnabledNetworks({ apiClient, queryClient }).caseOf({
    Right: async (networks) => {
      const filteredSubstrateChainsMap: Partial<SubstrateChainsMap> =
        typeSafeObjectFromEntries(
          typeSafeObjectEntries<SubstrateChainsMap>(substrateChainsMap).filter(
            ([_, v]) => networks.has(v.skChainName)
          )
        );

      const substrateChains = Object.values(filteredSubstrateChainsMap).map(
        (val) => val.wagmiChain
      );

      const lunoKitChains = Object.values(filteredSubstrateChainsMap).map(
        (val): LunoKitChain => ({
          ...val.wagmiChain,
          rpcUrls: {
            webSocket: [],
          },
          testnet: false,
          chainIconUrl:
            typeof val.wagmiChain.iconUrl === "string"
              ? val.wagmiChain.iconUrl
              : getNetworkLogo(val.skChainName),
          genesisHash: val.genesisHash as `0x${string}`,
          ss58Format: val.ss58Format,
        })
      );

      const connector = substrateChains.length
        ? Maybe.of(
            (await import("./substrate-connector")).getSubstrateConnectors(
              substrateChains,
              lunoKitChains,
              forceWalletConnectOnly
            )
          )
        : Maybe.empty();

      return {
        substrateChainsMap: filteredSubstrateChainsMap,
        substrateChains,
        connector,
      };
    },
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
    return new Error("Could not get substrate config");
  });
