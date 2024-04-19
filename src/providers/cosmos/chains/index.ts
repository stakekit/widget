import { CosmosNetworks } from "@stakekit/common";
import { getNetworkLogo, getTokenLogo } from "../../../utils";
import type { Chain as CosmosChain } from "./chain-registry";
import type { Chain } from "@stakekit/rainbowkit";
import { mainnet } from "viem/chains";
import type { WithWagmiName } from "../types";

export type CosmosChainsAssets = WithWagmiName<CosmosChain>;

export const getWagmiChain = (
  chain: CosmosChainsAssets
): Chain & { cosmosChainName: string } => ({
  id: chain.chain_id as unknown as number,
  iconUrl:
    chain.chain_id === "osmosis-1"
      ? getNetworkLogo(CosmosNetworks.Osmosis)
      : chain.chain_id === "mars-1"
        ? getTokenLogo("mars")
        : chain.logo_URIs?.png ?? chain.logo_URIs?.svg ?? "",

  name: chain.wagmiName,
  cosmosChainName: chain.chain_name,
  // TODO: change this
  nativeCurrency: mainnet.nativeCurrency,
  rpcUrls: {
    default: {
      http: chain.apis?.rpc?.map((r) => r.address) ?? [""],
    },
    public: {
      http: chain.apis?.rpc?.map((r) => r.address) ?? [""],
    },
  },
});
