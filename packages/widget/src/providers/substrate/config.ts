import type { Chain as LunoKitChain } from "@luno-kit/core/chains";
import type { Chain, WalletList } from "@stakekit/rainbowkit";
import { EitherAsync, Maybe } from "purify-ts";
import type { Networks } from "../../domain/types/chains/networks";
import {
  type SubstrateChainsMap,
  substrateChainsMap,
} from "../../domain/types/chains/substrate";
import {
  getNetworkLogo,
  typeSafeObjectEntries,
  typeSafeObjectFromEntries,
} from "../../utils";

const queryFn = async ({
  enabledNetworks,
  forceWalletConnectOnly,
}: {
  enabledNetworks: ReadonlySet<Networks>;
  forceWalletConnectOnly: boolean;
}): Promise<{
  substrateChainsMap: Partial<SubstrateChainsMap>;
  substrateChains: Chain[];
  connector: Maybe<{
    groupName: string;
    wallets: WalletList[number]["wallets"];
  }>;
}> => {
  const filteredSubstrateChainsMap: Partial<SubstrateChainsMap> =
    typeSafeObjectFromEntries(
      typeSafeObjectEntries<SubstrateChainsMap>(substrateChainsMap).filter(
        ([_, v]) => enabledNetworks.has(v.skChainName)
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
};

export const getConfig = (opts: Parameters<typeof queryFn>[0]) =>
  EitherAsync(() => queryFn(opts)).mapLeft((e) => {
    console.log(e);
    return new Error("Could not get substrate config");
  });
