import { CosmosNetworks, type Networks } from "@stakekit/common";
import type { Chain } from "@stakekit/rainbowkit";
import { Just } from "purify-ts";
import { mainnet } from "viem/chains";
import { getNetworkLogo, getTokenLogo } from "../../../utils";
import type { WithWagmiName } from "../types";
import type { Chain as CosmosChain } from "./chain-registry";

export type CosmosChainsAssets = WithWagmiName<CosmosChain>;

export const getWagmiChain = (
  chain: CosmosChainsAssets
): Chain & { cosmosChainName: string } => ({
  id: chain.chain_id as unknown as number,
  iconUrl: Just(chain.chain_id)
    .map((id) => {
      if (id === "osmosis-1") {
        return getNetworkLogo(CosmosNetworks.Osmosis);
      }

      if (id === "mars-1") {
        return getTokenLogo("mars");
      }

      return (
        chain.logo_URIs?.png ??
        chain.logo_URIs?.svg ??
        getNetworkLogo(chain.chain_name as Networks)
      );
    })
    .unsafeCoerce(),

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
