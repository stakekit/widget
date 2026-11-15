import type { MainWalletBase } from "@cosmos-kit/core";
import { Logger, WalletManager } from "@cosmos-kit/core";
import { wallets as keplrWallets } from "@cosmos-kit/keplr-extension";
import { wallets as leapWallets } from "@cosmos-kit/leap-extension";

import type { WalletAddress } from "../../../../../domain/identity/identifiers";
import { config } from "../../../../../shared/config/widget-defaults";
import type { Chain, WalletList } from "../../../wallet-descriptors";
import type { WalletConnectProtocol } from "../../platform/wallet-connect-protocol";
import { walletImages } from "../../runtime/assets";
import type { RunWalletEffect } from "../../runtime/effect-runner";
import type { CosmosChainsAssets, CosmosChainsMap } from "./chains";
import {
  cosmosAssets,
  registryIdsToSKCosmosNetworks,
} from "./chains/chain-registry";
import { type CosmosWallet, createCosmosConnector } from "./cosmos-connector";
import { makeExtensionWallet } from "./extension-wallet";
import { makeCosmosWalletConnectWallet } from "./wallet-connect";

export type CosmosWalletManagerOptions = {
  cosmosChainsMap: Partial<CosmosChainsMap>;
  walletConnectProtocol: WalletConnectProtocol;
  runWalletEffect: RunWalletEffect;
  persistPublicKey: (input: {
    readonly address: WalletAddress;
    readonly publicKey: string;
  }) => Promise<void>;
};

const cosmosHubRank = (chain: CosmosChainsAssets) =>
  registryIdsToSKCosmosNetworks[chain.chain_id] === "cosmos" ? 0 : 1;

export const getWalletManager = ({
  cosmosChainsMap,
  persistPublicKey,
  walletConnectProtocol,
  runWalletEffect,
}: CosmosWalletManagerOptions): {
  connector: {
    groupName: string;
    wallets: WalletList[number]["wallets"];
  };
  walletManager: WalletManager;
} => {
  // Extension packages only: the aggregate `@cosmos-kit/keplr` and
  // `@cosmos-kit/leap` catalogues add mobile wallets that run their own
  // WalletConnect clients. Mobile wallets connect through the generic
  // WalletConnect entry over the shared protocol instead.
  const extensionWallets: MainWalletBase[] = [...keplrWallets, ...leapWallets];
  const wallets: ReadonlyArray<() => CosmosWallet> = [
    ...keplrWallets.map((wallet) => () => makeExtensionWallet(wallet, "keplr")),
    ...leapWallets.map((wallet) => () => makeExtensionWallet(wallet, "leap")),
    () =>
      makeCosmosWalletConnectWallet({
        iconUrl: walletImages.wcLogo,
        runWalletEffect,
        walletConnectProtocol,
      }),
  ];
  const cosmosChainEntries = Object.values(cosmosChainsMap);
  const cosmosWagmiChains: Chain[] = cosmosChainEntries.map(
    (entry) => entry.wagmiChain
  );
  // Cosmos Hub first; the stable sort keeps the other chains in their order.
  const chains: CosmosChainsAssets[] = cosmosChainEntries
    .map((entry) => entry.chain)
    .toSorted((a, b) => cosmosHubRank(a) - cosmosHubRank(b));

  const connector: WalletList[number] = {
    groupName: "Cosmos",
    wallets: wallets.map(
      (wallet) => () =>
        createCosmosConnector({
          wallet: wallet(),
          cosmosChainsMap,
          cosmosWagmiChains,
          persistPublicKey,
          runWalletEffect,
        })
    ),
  };

  return {
    connector,
    walletManager: new WalletManager(
      chains,
      extensionWallets,
      new Logger(config.env.isDevMode ? "ERROR" : "NONE"),
      false,
      true,
      undefined,
      cosmosAssets
    ),
  };
};
