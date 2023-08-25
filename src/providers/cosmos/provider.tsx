import { PropsWithChildren } from "react";
import { assets } from "chain-registry";
import { ChainProvider } from "@cosmos-kit/react-lite";
import { wallets } from "../cosmos/config";
import { config } from "../../config";
import { cosmosChainsMap, filteredCosmosChainNames } from "./chains";

const chains = Object.values(cosmosChainsMap).map((c) => c.chain);
const assetLists = assets.filter((a) =>
  filteredCosmosChainNames.has(a.chain_name)
);

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
