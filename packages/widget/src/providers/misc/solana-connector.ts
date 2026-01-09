import type { Wallet } from "@solana/wallet-adapter-react";
import { WalletConnectWalletAdapter } from "@solana/wallet-adapter-wallets";
import {
  type Connection,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { MiscNetworks } from "@stakekit/common";
import type {
  Chain,
  WalletDetailsParams,
  WalletList,
} from "@stakekit/rainbowkit";
import { Maybe } from "purify-ts";
import { BehaviorSubject } from "rxjs";
import type { Address } from "viem";
import { createConnector } from "wagmi";
import portoIcon from "../../assets/images/porto.svg";
import { solana } from "../../domain/types/chains/misc";
import { getNetworkLogo } from "../../utils";
import type { VariantProps } from "../settings/types";
import {
  type ExtraProps,
  getConfigMeta,
  type StorageItem,
} from "./solana-connector-meta";

const createSolanaConnector = ({
  solanaWallet,
  walletDetailsParams,
  connection,
}: {
  solanaWallet: Wallet;
  walletDetailsParams: WalletDetailsParams;
  connection: Connection;
}) =>
  createConnector<unknown, ExtraProps, StorageItem>((config) => ({
    ...walletDetailsParams,
    isSolanaConnector: true,
    id: solanaWallet.adapter.name,
    name: solanaWallet.adapter.name,
    type: solanaWallet.adapter.name,
    showQrModal: false,
    sendTransaction: async (tx) => {
      const base64Decoded = Buffer.from(tx, "base64");
      const isBase64 = base64Decoded.toString("base64") === tx;

      const buffer = isBase64
        ? base64Decoded
        : Buffer.from(tx, "hex");

      let solanaTx: Transaction | VersionedTransaction;
      let versionedError: unknown;
      try {
        solanaTx = VersionedTransaction.deserialize(buffer);
      } catch (err) {
        versionedError = err;
        try {
          solanaTx = Transaction.from(buffer);
        } catch (legacyErr) {
          throw new Error(
            `Failed to deserialize Solana transaction. VersionedTransaction error: ${versionedError instanceof Error ? versionedError.message : String(versionedError)}. Legacy Transaction error: ${legacyErr instanceof Error ? legacyErr.message : String(legacyErr)}`
          );
        }
      }

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
      return Maybe.fromNullable(solanaWallet.adapter.publicKey?.toBase58())
        .map((val) => [val as Address])
        .unsafeCoerce();
    },
    switchChain: async () => solana,
    getChainId: async () => solana.id,
    isAuthorized: async () => {
      const isDisconnected = await config.storage?.getItem(
        "solana.disconnected"
      );

      if (isDisconnected) return false;

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
    $filteredChains: new BehaviorSubject<Chain[]>([solana]).asObservable(),
  }));

export const getSolanaConnectors = ({
  wallets,
  forceWalletConnectOnly,
  connection,
  variant,
}: {
  wallets: Wallet[];
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
              iconUrl: getNetworkLogo(MiscNetworks.Solana),
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
