import { BrowserWallet } from "@meshsdk/wallet";
import { MiscNetworks } from "@stakekit/common";
import type { WalletDetailsParams, WalletList } from "@stakekit/rainbowkit";
import { EitherAsync } from "purify-ts";
import { BehaviorSubject } from "rxjs";
import type { Address, Chain } from "viem";
import { createConnector } from "wagmi";
import { cardano } from "../../domain/types/chains/misc";
import { getStorageItem, setStorageItem } from "../../services/local-storage";
import { getNetworkLogo } from "../../utils";
import { configMeta, type ExtraProps } from "./cardano-connector-meta";

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
  createConnector<unknown, ExtraProps>((config) => {
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
      connect: async () => {
        config.emitter.emit("message", { type: "connecting" });

        setStorageItem("sk-widget@1//shimDisconnect/cardano", true);

        connectedWallet = await BrowserWallet.enable(wallet.id);

        const address = await connectedWallet
          .getUsedAddress()
          .then((address) => address.toBech32());

        setStorageItem("sk-widget@1//cardanoConnectors/lastConnectedWallet", {
          address,
          id: wallet.id,
        });

        return {
          accounts: [address as Address],
          chainId: cardano.id,
        };
      },
      disconnect: async () => {
        setStorageItem("sk-widget@1//shimDisconnect/cardano", false);
        setStorageItem(
          "sk-widget@1//cardanoConnectors/lastConnectedWallet",
          null
        );
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
        const [shimDisconnect, lastConnectedWallet] = [
          getStorageItem("sk-widget@1//shimDisconnect/cardano"),
          getStorageItem("sk-widget@1//cardanoConnectors/lastConnectedWallet"),
        ];

        if (shimDisconnect.isRight() && lastConnectedWallet.isRight()) {
          const shimDisconnectValue = shimDisconnect.extract();
          const lastConnectedWalletValue = lastConnectedWallet.extract();

          return !!(shimDisconnectValue && lastConnectedWalletValue);
        }

        return false;
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
