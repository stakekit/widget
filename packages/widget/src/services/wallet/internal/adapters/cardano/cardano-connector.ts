import { BrowserWallet } from "@meshsdk/wallet";
import type { WalletDetailsParams, WalletList } from "@stakekit/rainbowkit";
import { Effect, Stream } from "effect";
import type { Address, Chain } from "viem";
import { createConnector } from "wagmi";
import { WalletIntegrationError } from "../../../wallet-errors";
import { getWalletNetworkLogo } from "../../runtime/assets";
import { cardano } from "../configured-chains";
import { wagmiConnectResult } from "../wagmi-connect-result";
import {
  configMeta,
  type ExtraProps,
  type StorageItem,
} from "./cardano-connector-meta";

type MeshWallet = Awaited<
  ReturnType<(typeof BrowserWallet)["getAvailableWallets"]>
>[number];

const createCardanoConnector = ({
  wallet,
  walletDetailsParams,
}: {
  wallet: MeshWallet;
  walletDetailsParams: WalletDetailsParams;
}) =>
  createConnector<unknown, ExtraProps, StorageItem>((config) => {
    let connectedWallet: BrowserWallet | null = null;

    return {
      ...walletDetailsParams,
      id: wallet.id,
      name: wallet.name,
      type: configMeta.type,
      signTransaction: (tx: string) =>
        connectedWallet
          ? Effect.tryPromise({
              try: () => connectedWallet!.signTx(tx),
              catch: (cause) =>
                new WalletIntegrationError({
                  cause,
                  message:
                    cause instanceof Error ? cause.message : String(cause),
                  operation: "cardano-sign-transaction",
                }),
            })
          : Effect.fail(
              new WalletIntegrationError({
                message: "No wallet connected",
                operation: "cardano-sign-transaction",
              })
            ),
      connect: async (args) => {
        config.emitter.emit("message", { type: "connecting" });

        config.storage?.removeItem("cardano.disconnected");

        connectedWallet = await BrowserWallet.enable(wallet.id);

        const address = await connectedWallet
          .getUsedAddress()
          .then((address) => address.toBech32());

        config.storage?.setItem("cardano.lastConnectedWallet", {
          address,
          id: wallet.id,
        });

        return wagmiConnectResult(
          args?.withCapabilities,
          [address as Address],
          cardano.id
        );
      },
      disconnect: async () => {
        config.storage?.setItem("cardano.disconnected", true);
        config.storage?.removeItem("cardano.lastConnectedWallet");
        connectedWallet = null;
      },
      getAccounts: async () => {
        if (!connectedWallet) throw new Error("No wallet connected");

        return connectedWallet
          .getUsedAddress()
          .then((address) => [address.toBech32() as Address]);
      },
      switchChain: async () => cardano,
      getChainId: async () => cardano.id,
      isAuthorized: async () => {
        const isDisconnected = await config.storage?.getItem(
          "cardano.disconnected"
        );

        if (isDisconnected) return false;

        const lastConnectedWallet = await config.storage?.getItem(
          "cardano.lastConnectedWallet"
        );

        if (!lastConnectedWallet) return false;

        return lastConnectedWallet.id === wallet.id;
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
      getProvider: async () => ({}),
      $filteredChains: Stream.succeed<Chain[]>([cardano]),
    };
  });

export const getCardanoConnectors = (): WalletList[number] => ({
  groupName: "Cardano",
  wallets: BrowserWallet.getInstalledWallets().map((wallet) => () => ({
    id: wallet.id,
    name: wallet.name,
    iconUrl: wallet.icon,
    iconBackground: "#fff",
    chainGroup: {
      id: "cardano",
      title: "Cardano",
      iconUrl: getWalletNetworkLogo("cardano"),
    },
    createConnector: (walletDetailsParams) =>
      createCardanoConnector({ wallet, walletDetailsParams }),
  })),
});
