import type { MainWalletBase } from "@cosmos-kit/core";
import { Logger, WalletManager } from "@cosmos-kit/core";
import { wallets as keplrWallets } from "@cosmos-kit/keplr";
import { wallets as leapWallets } from "@cosmos-kit/leap";
import { CosmosNetworks } from "@stakekit/common";
import type { Chain, WalletList } from "@stakekit/rainbowkit";
import { Just } from "purify-ts";
import { config } from "../../config";
import type { CosmosChainsMap } from "../../domain/types/chains/cosmos";
import {
  cosmosAssets,
  registryIdsToSKCosmosNetworks,
} from "./chains/chain-registry";
import type { CosmosChainsAssets } from "./chains/types";
import { createCosmosConnector } from "./cosmos-connector";
import { WalletConnectWallet } from "./wallet-connect/main-wallet";
import { walletConnectInfo } from "./wallet-connect/registry";

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
}): {
  connector: {
    groupName: string;
    wallets: WalletList[number]["wallets"];
  };
  walletManager: WalletManager;
} => {
  const filteredWallets: MainWalletBase[] = forceWalletConnectOnly
    ? wallets.filter((w) => w instanceof WalletConnectWallet)
    : wallets;

  const { chains, cosmosWagmiChains } = Just(cosmosChainsMap)
    .map((val) =>
      Object.values(val).reduce(
        (acc, next) => {
          acc.cosmosWagmiChains.push(next.wagmiChain);
          acc.chains.push(next.chain);

          return acc;
        },
        {
          cosmosWagmiChains: [] as Chain[],
          chains: [] as CosmosChainsAssets[],
        }
      )
    )
    .map((val) => ({
      ...val,
      chains: val.chains.toSorted((a) =>
        // Put cosmos first
        registryIdsToSKCosmosNetworks[a.chain_id] === CosmosNetworks.Cosmos
          ? -1
          : 1
      ),
    }))
    .unsafeCoerce();

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
      chains,
      filteredWallets,
      new Logger(config.env.isDevMode ? "ERROR" : "NONE"),
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
