import { PropsWithChildren } from "react";
import { assets } from "chain-registry";
import { ChainProvider } from "@cosmos-kit/react-lite";
import { wallets } from "../cosmos/config";
import { config } from "../../config";
import { cosmosChainsMap, filteredCosmosChainNames } from "./chains";

const chains = Object.values(cosmosChainsMap).map((c) => c.chain);
const assetLists = assets.filter((a) => {
  // Patch comdex assets coingecko id
  if (a.chain_name === "comdex") {
    a.assets[1].coingecko_id = "harbor-2";
  }

  return filteredCosmosChainNames.has(a.chain_name);
});

export const CosmosProvider = ({ children }: PropsWithChildren) => {
  return (
    <ChainProvider
      chains={chains}
      assetLists={assetLists}
      wallets={wallets}
      walletConnectOptions={{
        signClient: { projectId: config.walletConnectV2.projectId },
      }}
    >
      {children}
    </ChainProvider>
  );
};
