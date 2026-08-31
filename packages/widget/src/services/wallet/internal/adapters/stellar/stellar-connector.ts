import type { WalletDetailsParams, WalletList } from "@stakekit/rainbowkit";
import { Effect, Option, Schema, Stream } from "effect";
import type { Address, Chain } from "viem";
import { createConnector } from "wagmi";
import { WalletIntegrationError } from "../../../wallet-errors";
import type { StellarWalletClient } from "../../platform/stellar-wallets-kit-platform";
import { getWalletNetworkLogo } from "../../runtime/assets";
import type { RunWalletEffect } from "../../runtime/effect-runner";
import { stellar } from "../configured-chains";
import {
  type ExtraProps,
  stellarConnectorType,
} from "./stellar-connector-meta";

const walletConnectId = "stellar-wallet-connect" as const;
const reconnectStorageKey = "stellar.reconnect" as const;

const ReconnectRecord = Schema.Struct({
  address: Schema.String,
  connectorId: Schema.String,
});

export type StellarStorage = {
  [reconnectStorageKey]: typeof ReconnectRecord.Type;
};

const createStellarConnector = ({
  client,
  runWalletEffect,
  walletDetailsParams,
}: {
  readonly client: StellarWalletClient;
  readonly runWalletEffect: RunWalletEffect;
  readonly walletDetailsParams: WalletDetailsParams;
}) =>
  createConnector<StellarWalletClient, ExtraProps, StellarStorage>((config) => {
    let currentAddress: Address | null = null;

    const readReconnectRecord = async () => {
      const stored = await config.storage?.getItem(reconnectStorageKey);
      return Schema.decodeUnknownOption(ReconnectRecord)(stored);
    };

    const clearLocalConnection = async () => {
      currentAddress = null;
      try {
        await config.storage?.removeItem(reconnectStorageKey);
      } catch {
        // The in-memory connection remains authoritative when storage fails.
      }
    };

    const restoreConnection = async () => {
      try {
        const stored = await readReconnectRecord();
        if (Option.isNone(stored) || stored.value.connectorId !== client.id) {
          throw new WalletIntegrationError({
            message: "No valid Stellar wallet connection was saved",
            operation: "stellar-reconnect",
          });
        }
        return await runWalletEffect(client.reconnect(stored.value.address));
      } catch (error) {
        await config.storage?.removeItem(reconnectStorageKey);
        throw error;
      }
    };

    return {
      ...walletDetailsParams,
      id: client.id,
      name: client.name,
      type: stellarConnectorType,
      connect: async (input) => {
        config.emitter.emit("message", { type: "connecting" });
        const result = input?.isReconnecting
          ? await restoreConnection()
          : await runWalletEffect(client.connect);
        if (!result.address) {
          throw new WalletIntegrationError({
            message: "Select an account in the Stellar wallet",
            operation: "stellar-read-address",
          });
        }
        try {
          await config.storage?.setItem(reconnectStorageKey, {
            address: result.address,
            connectorId: client.id,
          });
          currentAddress = result.address as Address;
        } catch (error) {
          await runWalletEffect(client.disconnect).catch(() => undefined);
          await clearLocalConnection();
          throw error;
        }

        return {
          accounts: input?.withCapabilities
            ? [{ address: currentAddress, capabilities: {} }]
            : [currentAddress],
          chainId: stellar.id,
        } as never;
      },
      disconnect: async () => {
        await runWalletEffect(client.disconnect).catch(() => undefined);
        await clearLocalConnection();
      },
      getAccounts: async () => (currentAddress ? [currentAddress] : []),
      getChainId: async () => stellar.id,
      getProvider: async () => client,
      isAuthorized: async () => {
        const stored = await readReconnectRecord();
        return Option.isSome(stored) && stored.value.connectorId === client.id;
      },
      onAccountsChanged: (accounts) => {
        if (accounts.length === 0) {
          config.emitter.emit("disconnect");
          return;
        }
        config.emitter.emit("change", { accounts: accounts as Address[] });
      },
      onChainChanged: (chainId) => {
        config.emitter.emit("change", { chainId: Number(chainId) });
      },
      onDisconnect: () => {
        config.emitter.emit("disconnect");
      },
      signTransaction: (input) =>
        client.signTransaction(input).pipe(
          Effect.tapError(() =>
            Effect.promise(async () => {
              await clearLocalConnection();
              config.emitter.emit("disconnect");
            })
          )
        ),
      switchChain: async () => {
        throw new WalletIntegrationError({
          message: "Stellar wallets support mainnet only",
          operation: "stellar-switch-chain",
        });
      },
      $filteredChains: Stream.succeed<Chain[]>([stellar]),
    };
  });

const downloadUrls = (client: StellarWalletClient) => {
  if (client.id === walletConnectId) return undefined;
  if (client.id === "freighter") {
    return {
      browserExtension:
        "https://chromewebstore.google.com/detail/freighter/bcacfldlkkdogcmkkibnjlakofdplcbk",
      chrome:
        "https://chromewebstore.google.com/detail/freighter/bcacfldlkkdogcmkkibnjlakofdplcbk",
      firefox: "https://addons.mozilla.org/firefox/addon/freighter/",
    };
  }
  return { browserExtension: client.productUrl };
};

export const getStellarConnectors = ({
  clients,
  forceWalletConnectOnly,
  isMobileWallet,
  runWalletEffect,
}: {
  readonly clients: ReadonlyArray<StellarWalletClient>;
  readonly forceWalletConnectOnly: boolean;
  readonly isMobileWallet: boolean;
  readonly runWalletEffect: RunWalletEffect;
}): WalletList[number] => ({
  groupName: "Stellar",
  wallets: clients
    .filter((client) => {
      if (forceWalletConnectOnly) return client.id === walletConnectId;
      if (!isMobileWallet) return true;
      return client.id === walletConnectId || client.installed;
    })
    .map((client) => () => ({
      id: client.id,
      name: client.name,
      iconUrl: client.iconUrl,
      iconBackground: "#fff",
      installed: client.installed,
      downloadUrls: downloadUrls(client),
      chainGroup: {
        id: "stellar",
        title: "Stellar",
        iconUrl: getWalletNetworkLogo("stellar"),
      },
      createConnector: (walletDetailsParams) =>
        createStellarConnector({
          client,
          runWalletEffect,
          walletDetailsParams,
        }),
    })),
});
