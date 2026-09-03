import type {
  Chain,
  ChainGroup,
  WalletDetailsParams,
  WalletList,
} from "@stakekit/rainbowkit";
import type { Adapter } from "@tronweb3/tronwallet-abstract-adapter";
import { BitKeepAdapter } from "@tronweb3/tronwallet-adapter-bitkeep";
import { LedgerAdapter } from "@tronweb3/tronwallet-adapter-ledger";
import { TronLinkAdapter } from "@tronweb3/tronwallet-adapter-tronlink";
import { WalletConnectAdapter } from "@tronweb3/tronwallet-adapter-walletconnect";
import { Stream } from "effect";
import type { Address } from "viem";
import { createConnector } from "wagmi";
import { config } from "../../../../../shared/config/widget-defaults";
import {
  getWalletNetworkLogo,
  getWalletTokenLogo,
  walletImages,
} from "../../runtime/assets";
import { tron } from "../configured-chains";
import { wagmiConnectResult } from "../wagmi-connect-result";
import type { ExtraProps, StorageItem } from "./tron-connector-meta";
import { configMeta } from "./tron-connector-meta";

const createTronConnector = ({
  adapter,
  metaConfig,
  walletDetailsParams,
}: {
  metaConfig: keyof typeof configMeta;
  adapter: Adapter;
  walletDetailsParams: WalletDetailsParams;
}) =>
  createConnector<unknown, ExtraProps, StorageItem>((config) => ({
    ...walletDetailsParams,
    id: configMeta[metaConfig].id,
    name: configMeta[metaConfig].name,
    type: configMeta[metaConfig].type,
    signTransaction: adapter.signTransaction.bind(adapter),
    connect: async (args) => {
      config.emitter.emit("message", { type: "connecting" });

      await adapter.connect();

      config.storage?.removeItem("tron.disconnected");

      return wagmiConnectResult(
        args?.withCapabilities,
        [adapter.address as Address],
        tron.id
      );
    },
    disconnect: () => {
      config.storage?.setItem("tron.disconnected", true);
      return adapter.disconnect();
    },
    getAccounts: async () => {
      if (!adapter.address) throw new Error("No account found");
      return [adapter.address as Address];
    },
    switchChain: async () => tron,
    getChainId: async () => tron.id,
    isAuthorized: async () => {
      const isDisconnected = await config.storage?.getItem("tron.disconnected");

      if (isDisconnected) return false;

      return !!(adapter.connected && adapter.address);
    },
    onAccountsChanged: (accounts: string[]) => {
      if (accounts.length === 0) {
        config.emitter.emit("disconnect");
      } else {
        config.emitter.emit("change", { accounts: accounts as Address[] });
      }
    },
    onChainChanged: (chainId) => {
      config.emitter.emit("change", {
        chainId: chainId as unknown as number,
      });
    },
    onDisconnect: () => {
      config.emitter.emit("disconnect");
    },
    getProvider: async () => adapter,
    $filteredChains: Stream.succeed<Chain[]>([tron]),
  }));

export const getTronConnectors = ({
  forceWalletConnectOnly,
}: {
  forceWalletConnectOnly: boolean;
}): WalletList[number] => {
  const wcWallet: WalletList[number]["wallets"][0] = () => ({
    id: configMeta.tronWc.id,
    name: configMeta.tronWc.name,
    iconUrl: walletImages.wcLogo,
    iconBackground: "#fff",
    installed: true,
    chainGroup: tronChainGroup,
    qrCode: {
      getUri: (uri) => uri,
    },
    createConnector: (walletDetailsParams) =>
      createTronConnector({
        walletDetailsParams,
        metaConfig: "tronWc",
        adapter: new WalletConnectAdapter({
          network: "Mainnet",
          options: {
            customStoragePrefix: "tronwalletconnect_",
            projectId: config.walletConnectV2.projectId,
          },
          web3ModalConfig: {
            themeVariables: { "--wcm-z-index": "99999999999" },
          },
        }),
      }),
  });

  const tronChainGroup = {
    iconUrl: getWalletNetworkLogo("tron"),
    title: "Tron",
    id: "tron",
  } satisfies ChainGroup;

  return {
    groupName: "Tron",
    wallets: forceWalletConnectOnly
      ? [wcWallet]
      : [
          () => ({
            id: configMeta.tronLink.id,
            name: configMeta.tronLink.name,
            iconUrl: getWalletTokenLogo("trx"),
            iconBackground: "#fff",
            chainGroup: tronChainGroup,
            createConnector: (walletDetailsParams) =>
              createTronConnector({
                walletDetailsParams,
                metaConfig: "tronLink",
                adapter: new TronLinkAdapter(),
              }),
          }),
          wcWallet,
          () => ({
            id: configMeta.tronBg.id,
            name: configMeta.tronBg.name,
            iconUrl: walletImages.bitget,
            iconBackground: "#fff",
            chainGroup: tronChainGroup,
            createConnector: (walletDetailsParams) =>
              createTronConnector({
                walletDetailsParams,
                adapter: new BitKeepAdapter(),
                metaConfig: "tronBg",
              }),
          }),
          () => ({
            id: configMeta.tronLedger.id,
            name: configMeta.tronLedger.name,
            iconUrl: walletImages.ledgerLogo,
            iconBackground: "#fff",
            chainGroup: tronChainGroup,
            createConnector: (walletDetailsParams) =>
              createTronConnector({
                walletDetailsParams,
                metaConfig: "tronLedger",
                adapter: new LedgerAdapter() as unknown as Adapter,
              }),
          }),
        ],
  };
};
