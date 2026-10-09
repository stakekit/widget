import type { MainWalletBase } from "@cosmos-kit/core";
import { Logger, WalletManager } from "@cosmos-kit/core";
import { wallets as keplrWallets } from "@cosmos-kit/keplr-extension";
import { wallets as leapWallets } from "@cosmos-kit/leap-extension";
import { wallets as leapSnapWallets } from "@cosmos-kit/leap-metamask-cosmos-snap";
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
  const extensionWallets: MainWalletBase[] = [
    ...keplrWallets,
    ...leapWallets,
    ...leapSnapWallets,
  ];
  const wallets: ReadonlyArray<() => CosmosWallet> = [
    ...keplrWallets.map((wallet) => () => makeExtensionWallet(wallet, "keplr")),
    ...leapWallets.map((wallet) => () => makeExtensionWallet(wallet, "leap")),
    ...leapSnapWallets.map(
      (wallet) => () => makeExtensionWallet(wallet, "metaMask")
    ),
    () =>
      makeCosmosWalletConnectWallet({
        iconUrl: walletImages.wcLogo,
        runWalletEffect,
        walletConnectProtocol,
      }),
  ];
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
    registryIdsToSKCosmosNetworks[a.chain_id] === "cosmos" ? -1 : 1
  );

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
      cosmosAssets as ConstructorParameters<typeof WalletManager>[6]
    ),
  };
};
