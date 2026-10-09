import {
  WalletNotReadyError,
  WalletReadyState,
} from "@solana/wallet-adapter-base";
import {
  type Connection,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { Effect, Stream } from "effect";
import type { Address } from "viem";
import { createConnector } from "wagmi";
import type { VariantProps } from "../../../../../public-api/react-types";
import portoIcon from "../../../../../shared/assets/images/porto.svg";
import type {
  Chain,
  WalletAvailability,
  WalletDetailsParams,
  WalletList,
} from "../../../wallet-descriptors";
import { WalletNotAvailableError } from "../../../wallet-errors";
import { getWalletNetworkLogo } from "../../runtime/assets";
import type { SolanaWalletDescriptor } from "../../runtime/solana-runtime";
import { WalletConnectSolanaAdapter } from "../../runtime/solana-wallet-connect-adapter";
import { solana } from "../configured-chains";
import { wagmiConnectResult } from "../wagmi-connect-result";
import { makeWagmiConnectorEvents } from "../wagmi-connector-events";
import {
  type ExtraProps,
  extensionInstallUrls,
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
  createConnector<unknown, ExtraProps, StorageItem>((config) => {
    // A wallet-side WalletConnect session end has no wagmi caller; report it.
    if (solanaWallet.adapter instanceof WalletConnectSolanaAdapter) {
      solanaWallet.adapter.subscribeEnded(() =>
        config.emitter.emit("disconnect")
      );
    }
    return {
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

        const walletId = solanaWallet.adapter.name;
        // Adapters keep a settled readyState; ask whether the provider is still there.
        if (
          solanaWallet.readyState !== WalletReadyState.Loadable &&
          !solanaWallet.isPresent()
        ) {
          throw new WalletNotAvailableError({ walletId });
        }
        await solanaWallet.adapter.connect().catch((error: unknown) => {
          if (error instanceof WalletNotReadyError) {
            throw new WalletNotAvailableError({ walletId });
          }
          throw error;
        });

        return wagmiConnectResult(
          args?.withCapabilities,
          [solanaWallet.adapter.publicKey?.toBase58() as Address],
          solana.id
        );
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

      ...makeWagmiConnectorEvents(config.emitter),
      getProvider: async () => ({}),
      $filteredChains: Stream.succeed<Chain[]>([solana]),
    };
  });

/**
 * Loadable adapters (WalletConnect, Solana Mobile) connect without an
 * extension; the rest need their provider in the page, checked live.
 */
const availability = ({
  adapter,
  isPresent,
  readyState,
}: SolanaWalletDescriptor): WalletAvailability => {
  if (readyState === WalletReadyState.Loadable) return { _tag: "Remote" };
  if (readyState === WalletReadyState.Unsupported) {
    return { _tag: "Injected", detect: Effect.succeed(false) };
  }
  return {
    _tag: "Injected",
    detect: Effect.sync(
      () => adapter.readyState === WalletReadyState.Installed && isPresent()
    ),
    installUrl: extensionInstallUrls[adapter.name],
  };
};

export const getSolanaConnectors = ({
  wallets,
  connection,
  variant,
}: {
  wallets: ReadonlyArray<SolanaWalletDescriptor>;
  connection: Connection;
  variant: VariantProps["variant"];
}): WalletList[number] => {
  return {
    groupName: "Solana",
    wallets: wallets
      .filter((w) =>
        variant === "porto"
          ? w.adapter instanceof WalletConnectSolanaAdapter
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
        availability: availability(w),
        createConnector: (walletDetailsParams) =>
          createSolanaConnector({
            solanaWallet: w,
            walletDetailsParams,
            connection,
          }),
      })),
  };
};
