import type { Chain } from "@stakekit/rainbowkit";
import { mainnet } from "viem/chains";
import type { Network } from "../../../../../../domain/network/network";
import { CosmosNetworks } from "../../../../../../domain/network/networks";
import {
  getWalletNetworkLogo,
  getWalletTokenLogo,
} from "../../../runtime/assets";
import type { CosmosChainsAssets } from "../chains";

const getChainIconUrl = (chain: CosmosChainsAssets) => {
  if (chain.chain_id === "osmosis-1") {
    return getWalletNetworkLogo(CosmosNetworks.Osmosis);
  }
  if (chain.chain_id === "mars-1") return getWalletTokenLogo("mars");
  return (
    chain.logo_URIs?.png ??
    chain.logo_URIs?.svg ??
    getWalletNetworkLogo(chain.chain_name as Network)
  );
};

export const getWagmiChain = (
  chain: CosmosChainsAssets
): Chain & { cosmosChainName: string } => ({
  id: chain.chain_id as unknown as number,
  iconUrl: getChainIconUrl(chain),

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
