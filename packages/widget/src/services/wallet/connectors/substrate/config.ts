import type { Chain as LunoKitChain } from "@luno-kit/core/chains";
import type { Chain, WalletList } from "@stakekit/rainbowkit";
import { Effect, Record } from "effect";
import type { Network } from "../../../../domain/schema/network-model";

import {
  type SubstrateChainsMap,
  substrateChainsMap,
} from "../../../../domain/types/chains/substrate";
import { getWalletNetworkLogo } from "../../assets";
import { WalletIntegrationError } from "../../domain/errors";

const queryFn = async ({
  enabledNetworks,
  forceWalletConnectOnly,
}: {
  enabledNetworks: ReadonlySet<Network>;
  forceWalletConnectOnly: boolean;
}): Promise<{
  substrateChainsMap: Partial<SubstrateChainsMap>;
  substrateChains: Chain[];
  connector: {
    groupName: string;
    wallets: WalletList[number]["wallets"];
  } | null;
}> => {
  const filteredSubstrateChainsMap: Partial<SubstrateChainsMap> = Record.filter(
    substrateChainsMap,
    (v) => enabledNetworks.has(v.skChainName)
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
          : getWalletNetworkLogo(val.skChainName),
      genesisHash: val.genesisHash as `0x${string}`,
      ss58Format: val.ss58Format,
    })
  );

  const connector = substrateChains.length
    ? (await import("./substrate-connector")).getSubstrateConnectors(
        substrateChains,
        lunoKitChains,
        forceWalletConnectOnly
      )
    : null;

  return {
    substrateChainsMap: filteredSubstrateChainsMap,
    substrateChains,
    connector,
  };
};

export const getConfig = (opts: Parameters<typeof queryFn>[0]) =>
  Effect.tryPromise({
    try: () => queryFn(opts),
    catch: (cause) =>
      new WalletIntegrationError({
        cause,
        message: "Could not get substrate config",
        operation: "substrate-config",
      }),
  });
