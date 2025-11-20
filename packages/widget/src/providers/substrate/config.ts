import type { Chain as LunoKitChain } from "@luno-kit/core/chains";
import type { Chain, WalletList } from "@stakekit/rainbowkit";
import type { QueryClient } from "@tanstack/react-query";
import { EitherAsync, Maybe } from "purify-ts";
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
import { getEnabledNetworks } from "../api/get-enabled-networks";
import { getSubstrateConnectors } from "./substrate-connector";

const queryKey = [config.appPrefix, "substrate-config"];
const staleTime = Number.POSITIVE_INFINITY;

const queryFn = async ({
  queryClient,
  forceWalletConnectOnly,
}: {
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
  getEnabledNetworks({ queryClient }).caseOf({
    Right: (networks) => {
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

      return Promise.resolve({
        substrateChainsMap: filteredSubstrateChainsMap,
        substrateChains,
        connector: Maybe.fromFalsy(substrateChains.length > 0).map(() =>
          getSubstrateConnectors(
            substrateChains,
            lunoKitChains,
            forceWalletConnectOnly
          )
        ),
      });
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
