import type { Chain } from "@stakekit/rainbowkit";
import { mainnet } from "viem/chains";
import type { Network } from "../../../../../domain/schema/network-model";
import type { CosmosChainsAssets } from "../../../../../domain/types/chains/cosmos";
import { CosmosNetworks } from "../../../../../domain/types/chains/networks";
import { getWalletNetworkLogo, getWalletTokenLogo } from "../../../assets";

export const getWagmiChain = (
  chain: CosmosChainsAssets
): Chain & { cosmosChainName: string } => ({
  id: chain.chain_id as unknown as number,
  iconUrl:
    chain.chain_id === "osmosis-1"
      ? getWalletNetworkLogo(CosmosNetworks.Osmosis)
      : chain.chain_id === "mars-1"
        ? getWalletTokenLogo("mars")
        : (chain.logo_URIs?.png ??
          chain.logo_URIs?.svg ??
          getWalletNetworkLogo(chain.chain_name as Network)),

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
