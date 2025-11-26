import { BrowserWallet } from "@meshsdk/wallet";
import { MiscNetworks } from "@stakekit/common";
import type { WalletDetailsParams, WalletList } from "@stakekit/rainbowkit";
import { EitherAsync } from "purify-ts";
import { BehaviorSubject } from "rxjs";
import type { Address, Chain } from "viem";
import { createConnector } from "wagmi";
import { cardano } from "../../domain/types/chains/misc";
import { getNetworkLogo } from "../../utils";
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
        EitherAsync(({ throwE }) => {
          if (!connectedWallet) {
            return throwE(new Error("No wallet connected"));
          }

          return connectedWallet.signTx(tx);
        }),
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

        return {
          accounts: args?.withCapabilities
            ? [{ address: address as Address, capabilities: {} }]
            : [address as Address],
          chainId: cardano.id,
        } as never;
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
      $filteredChains: new BehaviorSubject<Chain[]>([cardano]).asObservable(),
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
      iconUrl: getNetworkLogo(MiscNetworks.Cardano),
    },
    createConnector: (walletDetailsParams) =>
      createCardanoConnector({ wallet, walletDetailsParams }),
  })),
});
