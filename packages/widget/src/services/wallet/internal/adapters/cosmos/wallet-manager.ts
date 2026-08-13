import type { MainWalletBase } from "@cosmos-kit/core";
import { Logger, WalletManager } from "@cosmos-kit/core";
import { wallets as keplrWallets } from "@cosmos-kit/keplr";
import { wallets as leapWallets } from "@cosmos-kit/leap";
import type { Chain, WalletList } from "@stakekit/rainbowkit";
import type { WalletAddress } from "../../../../../domain/identity/identifiers";
import { CosmosNetworks } from "../../../../../domain/network/networks";
import { config } from "../../../../../shared/config/widget-defaults";
import type { CosmosChainsAssets, CosmosChainsMap } from "./chains";
import {
  cosmosAssets,
  registryIdsToSKCosmosNetworks,
} from "./chains/chain-registry";
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
  persistPublicKey,
}: {
  forceWalletConnectOnly: boolean;
  cosmosChainsMap: Partial<CosmosChainsMap>;
  persistPublicKey: (input: {
    readonly address: WalletAddress;
    readonly publicKey: string;
  }) => Promise<void>;
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

  chains.sort((a) =>
    // Put cosmos first
    registryIdsToSKCosmosNetworks[a.chain_id] === CosmosNetworks.Cosmos ? -1 : 1
  );

  const connector: WalletList[number] = {
    groupName: "Cosmos",
    wallets: filteredWallets.map(
      (w) => () =>
        createCosmosConnector({
          wallet: w,
          cosmosChainsMap,
          cosmosWagmiChains,
          persistPublicKey,
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
