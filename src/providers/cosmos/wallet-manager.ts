import type { MainWalletBase } from "@cosmos-kit/core";
import { Logger, WalletManager } from "@cosmos-kit/core";
import { wallets as keplrWallets } from "@cosmos-kit/keplr";
import { wallets as leapWallets } from "@cosmos-kit/leap";
import type { CosmosChainsMap } from "../../domain/types/chains";
import { WalletConnectWallet, walletConnectInfo } from "./wallet-connect";
import {
  cosmosAssets,
  registryIdsToSKCosmosNetworks,
} from "./chains/chain-registry";
import { config } from "../../config";
import type { Chain, WalletList } from "@stakekit/rainbowkit";
import { createCosmosConnector } from "./cosmos-connector";
import type { CosmosChainsAssets } from "./chains";
import { CosmosNetworks } from "@stakekit/common";

const wallets: MainWalletBase[] = [
  ...keplrWallets,
  ...leapWallets,
  new WalletConnectWallet(walletConnectInfo),
];

export const getWalletManager = ({
  cosmosChainsMap,
  forceWalletConnectOnly,
}: {
  forceWalletConnectOnly: boolean;
  cosmosChainsMap: Partial<CosmosChainsMap>;
}) => {
  const filteredWallets: MainWalletBase[] = forceWalletConnectOnly
    ? wallets.filter((w) => w instanceof WalletConnectWallet)
    : wallets;

  const { chains, cosmosWagmiChains } = Object.values(cosmosChainsMap).reduce(
    (acc, next) => {
      acc.cosmosWagmiChains.push(next.wagmiChain);
      acc.chains.push(next.chain);

      return acc;
    },
    {
      cosmosWagmiChains: [] as Chain[],
      chains: [] as CosmosChainsAssets[],
    }
  );

  const connector: WalletList[number] = {
    groupName: "Cosmos",
    wallets: filteredWallets.map(
      (w) => () =>
        createCosmosConnector({
          wallet: w,
          cosmosChainsMap,
          cosmosWagmiChains,
        })
    ),
  };

  return {
    connector,
    walletManager: new WalletManager(
      chains.sort((a) =>
        // Put cosmos first
        registryIdsToSKCosmosNetworks[a.chain_id] === CosmosNetworks.Cosmos
          ? -1
          : 1
      ),
      filteredWallets,
      new Logger("ERROR"),
      false,
      true,
      undefined,
      cosmosAssets as ConstructorParameters<typeof WalletManager>[6],
      undefined,
      {
        signClient: {
          projectId: config.walletConnectV2.projectId,
          customStoragePrefix: "cosmoswalletconnect_",
        },
      }
    ),
  };
};
