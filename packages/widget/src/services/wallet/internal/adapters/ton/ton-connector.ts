import type { WalletDetailsParams, WalletList } from "@stakekit/rainbowkit";
import {
  Cell,
  type CommonMessageInfoRelaxedInternal,
  loadMessageRelaxed,
} from "@ton/core";
import {
  TonConnectUI,
  toUserFriendlyAddress,
  type Wallet,
} from "@tonconnect/ui";
import { Clock, Duration, Effect, Schema, Stream } from "effect";
import type { Address, Chain } from "viem";
import { createConnector } from "wagmi";
import { MiscNetworks } from "../../../../../domain/network/networks";
import { WalletIntegrationError } from "../../../wallet-errors";
import { getWalletNetworkLogo } from "../../runtime/assets";
import { ton } from "../configured-chains";
import {
  configMeta,
  type ExtraProps,
  type StorageItem,
} from "./ton-connector-meta";
import { unsignedTonTransactionTonConnectCodec } from "./transaction";

const createTonConnector = (
  walletDetailsParams: WalletDetailsParams,
  manifestUrl: string | undefined
) =>
  createConnector<unknown, ExtraProps, StorageItem>((config) => {
    const tonconnectUI = new TonConnectUI({
      manifestUrl:
        manifestUrl ?? "https://dapp.stakek.it/tonconnect-manifest.json",
    });

    let deferred: {
      resolve: (wallet: Wallet) => void;
      reject: () => void;
    } | null = null;
    let connectedWallet: Wallet | null = null;

    tonconnectUI.onStatusChange((wallet) => {
      connectedWallet = wallet;
      if (wallet) {
        deferred?.resolve(wallet);
      }
    });

    tonconnectUI.onModalStateChange((state) => {
      if (state.status === "closed") {
        deferred?.reject();
      }
    });

    return {
      ...walletDetailsParams,
      id: "tonconnect",
      name: "TonConnect",
      type: configMeta.type,
      signTransaction: (tx: string) =>
        Effect.gen(function* () {
          if (!connectedWallet) {
            return yield* Effect.fail(
              new WalletIntegrationError({
                message: "No wallet connected",
                operation: "ton-send-transaction",
              })
            );
          }

          const { message } = yield* Schema.decodeEffect(
            Schema.fromJsonString(unsignedTonTransactionTonConnectCodec)
          )(tx).pipe(
            Effect.mapError(
              (cause) =>
                new WalletIntegrationError({
                  cause,
                  message: cause.message,
                  operation: "ton-decode-transaction",
                })
            )
          );
          const parsedTx = yield* Effect.try({
            try: () =>
              loadMessageRelaxed(Cell.fromBase64(message).beginParse()),
            catch: (cause) =>
              new WalletIntegrationError({
                cause,
                message: String(cause),
                operation: "ton-decode-message",
              }),
          });

          const info = parsedTx.info as CommonMessageInfoRelaxedInternal;
          const now = yield* Clock.currentTimeMillis;

          const result = yield* Effect.tryPromise({
            try: () =>
              tonconnectUI.sendTransaction({
                messages: [
                  {
                    address: info.dest.toString(),
                    amount: info.value.coins.toString(),
                    payload: parsedTx.body.toBoc().toString("base64"),
                  },
                ],
                validUntil: now + Duration.toMillis(Duration.days(1)),
              }),
            catch: (cause) =>
              new WalletIntegrationError({
                cause,
                message: cause instanceof Error ? cause.message : String(cause),
                operation: "ton-send-transaction",
              }),
          });

          const externalMessageCell = Cell.fromBase64(result.boc);
          const txHash = externalMessageCell.hash().toString("hex");

          return txHash;
        }),
      connect: async (args) => {
        config.emitter.emit("message", { type: "connecting" });

        config.storage?.removeItem("ton.disconnected");

        const wallet: Wallet =
          connectedWallet ??
          (await tonconnectUI
            .openModal()
            .then(
              () =>
                new Promise<Wallet>((resolve, reject) => {
                  deferred = { resolve, reject };
                })
            )
            .then((wallet) => {
              deferred = null;
              return wallet;
            }));

        const userFriendlyAddress = toUserFriendlyAddress(
          wallet.account.address
        );

        return {
          accounts: args?.withCapabilities
            ? [
                {
                  address: userFriendlyAddress as Address,
                  capabilities: {},
                },
              ]
            : [userFriendlyAddress as Address],
          chainId: ton.id,
        } as never;
      },
      disconnect: async () => {
        config.storage?.setItem("ton.disconnected", true);
        await tonconnectUI.disconnect();
        connectedWallet = null;
      },
      getAccounts: async () => {
        await tonconnectUI.connectionRestored;

        if (!connectedWallet) throw new Error("No wallet connected");

        return [
          toUserFriendlyAddress(connectedWallet.account.address) as Address,
        ];
      },
      switchChain: async () => ton,
      getChainId: async () => ton.id,
      isAuthorized: async () => {
        await tonconnectUI.connectionRestored;

        const isDisconnected =
          await config.storage?.getItem("ton.disconnected");

        if (isDisconnected) return false;

        return !!connectedWallet;
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
      $filteredChains: Stream.succeed<Chain[]>([ton]),
    };
  });

export const getTonConnectors = ({
  tonConnectManifestUrl,
}: {
  tonConnectManifestUrl: string | undefined;
}): WalletList[number] => ({
  groupName: "Ton",
  wallets: [
    () => ({
      id: "tonconnect",
      name: "TonConnect",
      iconUrl: getWalletNetworkLogo(MiscNetworks.Ton),
      iconBackground: "transparent",
      chainGroup: {
        id: "ton",
        title: "Ton",
        iconUrl: getWalletNetworkLogo(MiscNetworks.Ton),
      },
      createConnector: (walletDetailsParams) =>
        createTonConnector(walletDetailsParams, tonConnectManifestUrl),
    }),
  ],
});
