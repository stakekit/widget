import { PropsWithChildren } from "react";
import { ChainProvider } from "@cosmos-kit/react-lite";
import { wallets } from "../cosmos/config";
import { config } from "../../config";
import { cosmosChainsMap } from "./chains";

const chains = Object.values(cosmosChainsMap).map((c) => c.chain);

export const CosmosProvider = ({ children }: PropsWithChildren) => {
  return (
    <ChainProvider
      chains={chains}
      assetLists={[]}
      wallets={wallets}
      walletConnectOptions={{
        signClient: { projectId: config.walletConnectV2.projectId },
      }}
    >
      {children}
    </ChainProvider>
  );
};
