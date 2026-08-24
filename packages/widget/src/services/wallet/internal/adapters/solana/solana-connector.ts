import { WalletConnectWalletAdapter } from "@solana/wallet-adapter-wallets";
import {
  type Connection,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import type {
  Chain,
  WalletDetailsParams,
  WalletList,
} from "@stakekit/rainbowkit";
import { Stream } from "effect";
import type { Address } from "viem";
import { createConnector } from "wagmi";
import type { VariantProps } from "../../../../../public-api/types";
import portoIcon from "../../../../../shared/assets/images/porto.svg";
import { getWalletNetworkLogo } from "../../runtime/assets";
import type { SolanaWalletDescriptor } from "../../runtime/solana-runtime";
import { solana } from "../configured-chains";
import {
  type ExtraProps,
  getConfigMeta,
  type StorageItem,
} from "./solana-connector-meta";
import { decodeSolanaTransactionToBuffer } from "./transaction";

export const deserializeSolanaTransaction = (
  tx: string
): Transaction | VersionedTransaction => {
  const decodedTx = decodeSolanaTransactionToBuffer(tx);
  let versionedError: unknown;

  try {
    return VersionedTransaction.deserialize(decodedTx.buffer);
  } catch (error) {
    versionedError = error;
  }

  try {
    return Transaction.from(decodedTx.buffer);
  } catch (legacyError) {
    throw new Error(
      `Failed to deserialize Solana transaction. encoding=${decodedTx.encoding} bufferLength=${decodedTx.buffer.length} VersionedTransaction error: ${
        versionedError instanceof Error
          ? versionedError.message
          : String(versionedError)
      }. Legacy Transaction error: ${
        legacyError instanceof Error ? legacyError.message : String(legacyError)
      }`
    );
  }
};

const createSolanaConnector = ({
  solanaWallet,
  walletDetailsParams,
  connection,
}: {
  solanaWallet: SolanaWalletDescriptor;
  walletDetailsParams: WalletDetailsParams;
  connection: Connection;
}) =>
  createConnector<unknown, ExtraProps, StorageItem>((config) => ({
    ...walletDetailsParams,
    isSolanaConnector: true,
    solanaAdapter: solanaWallet.adapter,
    solanaAdapterSource: solanaWallet.source,
    id: solanaWallet.adapter.name,
    name: solanaWallet.adapter.name,
    type: solanaWallet.adapter.name,
    showQrModal: false,
    sendTransaction: async (tx) => {
      const solanaTx = deserializeSolanaTransaction(tx);

      const signed = await solanaWallet.adapter.sendTransaction(
        solanaTx,
        connection
      );
      return signed;
    },
    connect: async (args) => {
      config.emitter.emit("message", { type: "connecting" });

      config.storage?.removeItem("solana.disconnected");

      await solanaWallet.adapter.connect();

      return {
        accounts: args?.withCapabilities
          ? [
              {
                address: solanaWallet.adapter.publicKey?.toBase58() as Address,
                capabilities: {},
              },
            ]
          : [solanaWallet.adapter.publicKey?.toBase58() as Address],
        chainId: solana.id,
      } as never;
    },
    disconnect: () => {
      config.storage?.setItem("solana.disconnected", true);
      return solanaWallet.adapter.disconnect();
    },
    getAccounts: async () => {
      const address = solanaWallet.adapter.publicKey?.toBase58();
      if (!address) throw new Error("No account found");
      return [address as Address];
    },
    switchChain: async () => solana,
    getChainId: async () => solana.id,
    isAuthorized: async () => {
      const isDisconnected = await config.storage?.getItem(
        "solana.disconnected"
      );

      if (isDisconnected) return false;

      const recentConnectorId =
        await config.storage?.getItem("recentConnectorId");

      if (
        recentConnectorId &&
        recentConnectorId === solanaWallet.adapter.name
      ) {
        await solanaWallet.adapter.autoConnect();
      }

      return !!(
        solanaWallet.adapter.connected &&
        solanaWallet.adapter.publicKey?.toBase58()
      );
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
    $filteredChains: Stream.succeed<Chain[]>([solana]),
  }));

export const getSolanaConnectors = ({
  wallets,
  forceWalletConnectOnly,
  connection,
  variant,
}: {
  wallets: ReadonlyArray<SolanaWalletDescriptor>;
  forceWalletConnectOnly: boolean;
  connection: Connection;
  variant: VariantProps["variant"];
}): WalletList[number] => {
  return {
    groupName: "Solana",
    wallets: forceWalletConnectOnly
      ? []
      : wallets
          .filter((w) =>
            variant === "porto"
              ? w.adapter instanceof WalletConnectWalletAdapter
              : true
          )
          .map((w) => () => ({
            id: w.adapter.name,
            name: variant === "porto" ? "Porto" : w.adapter.name,
            iconUrl: variant === "porto" ? portoIcon : w.adapter.icon,
            iconBackground: variant === "porto" ? "#000" : "#fff",
            chainGroup: {
              iconUrl: getWalletNetworkLogo("solana"),
              title: "Solana",
              id: "solana",
            },
            installed:
              w.readyState === "Installed" || w.readyState === "Loadable",
            ...getConfigMeta(w.adapter),
            createConnector: (walletDetailsParams) =>
              createSolanaConnector({
                solanaWallet: w,
                walletDetailsParams,
                connection,
              }),
          })),
  };
};
