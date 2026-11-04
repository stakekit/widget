import { Schema } from "effect";
import { mainnet } from "viem/chains";
import { Network } from "../../../../../../domain/network/network";
import type { Chain } from "../../../../wallet-descriptors";
import {
  getWalletNetworkLogo,
  getWalletTokenLogo,
} from "../../../runtime/assets";
import { toWagmiChainId } from "../../../wagmi-seam";
import type { CosmosChainsAssets } from "../chains";

const isNetwork = Schema.is(Network);

const getChainIconUrl = (chain: CosmosChainsAssets) => {
  if (chain.chain_id === "osmosis-1") {
    return getWalletNetworkLogo("osmosis");
  }
  if (chain.chain_id === "mars-1") return getWalletTokenLogo("mars");
  const registryLogo = chain.logo_URIs?.png ?? chain.logo_URIs?.svg;
  if (registryLogo !== undefined) return registryLogo;
  return isNetwork(chain.chain_name)
    ? getWalletNetworkLogo(chain.chain_name)
    : undefined;
};

export const getWagmiChain = (
  chain: CosmosChainsAssets
): Chain & { cosmosChainName: string } => {
  const iconUrl = getChainIconUrl(chain);
  return {
    id: toWagmiChainId(chain.chain_id),
    ...(iconUrl === undefined ? {} : { iconUrl }),

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
  };
};
