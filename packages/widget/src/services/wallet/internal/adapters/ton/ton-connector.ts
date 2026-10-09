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
import { Clock, Duration, Effect, Option, Schema, Stream } from "effect";
import type { Address, Chain } from "viem";
import { createConnector } from "wagmi";
import type {
  WalletDetailsParams,
  WalletList,
} from "../../../wallet-descriptors";
import { WalletIntegrationError } from "../../../wallet-errors";
import type { WalletModal } from "../../../wallet-modal";
import { getWalletNetworkLogo } from "../../runtime/assets";
import type { RunWalletEffect } from "../../runtime/effect-runner";
import { ton } from "../configured-chains";
import { wagmiConnectResult } from "../wagmi-connect-result";
import {
  configMeta,
  type ExtraProps,
  type StorageItem,
} from "./ton-connector-meta";
import { unsignedTonTransactionTonConnectCodec } from "./transaction";

type TonConnectorOptions = Readonly<{
  runWalletEffect: RunWalletEffect;
  tonConnectManifestUrl: string | undefined;
  walletModal: WalletModal["Service"];
}>;

const ModalState = Schema.Struct({
  status: Schema.Literals(["opened", "closed"]),
});
const decodeModalState = Schema.decodeUnknownOption(ModalState);

const createTonConnector = (
  walletDetailsParams: WalletDetailsParams,
  { runWalletEffect, tonConnectManifestUrl, walletModal }: TonConnectorOptions
) =>
  createConnector<unknown, ExtraProps, StorageItem>((config) => {
    const tonconnectUI = new TonConnectUI({
      manifestUrl:
        tonConnectManifestUrl ??
        "https://dapp.stakek.it/tonconnect-manifest.json",
    });

    let deferred: {
      resolve: (wallet: Wallet) => void;
      reject: () => void;
    } | null = null;
    let connectedWallet: Wallet | null = null;
    // TON releases only the picker suspension it started, never AppKit's.
    let ownsSuspension = false;
    let connecting = false;
    const releaseSuspension = () => {
      if (!ownsSuspension) return Promise.resolve();
      ownsSuspension = false;
      return runWalletEffect(walletModal.presentationOpen.set(false));
    };

    tonconnectUI.onStatusChange((wallet) => {
      connectedWallet = wallet;
      if (wallet) {
        deferred?.resolve(wallet);
      }
    });

    // TonConnect renders its modal outside the picker, so the picker steps
    // aside while it is open. A connect in flight releases it once settled;
    // any other close (e.g. a transaction prompt) releases it at once.
    tonconnectUI.onModalStateChange((state) => {
      const status = Option.getOrUndefined(decodeModalState(state))?.status;
      if (status === "opened") {
        ownsSuspension = true;
        void runWalletEffect(walletModal.presentationOpen.set(true));
      }
      if (status === "closed") {
        deferred?.reject();
        if (!connecting) void releaseSuspension();
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
            return yield* new WalletIntegrationError({
              message: "No wallet connected",
              operation: "ton-send-transaction",
            });
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
          (await (async () => {
            connecting = true;
            try {
              await tonconnectUI.openModal();
              return await new Promise<Wallet>((resolve, reject) => {
                deferred = { resolve, reject };
              });
            } finally {
              deferred = null;
              connecting = false;
              // A selected wallet keeps the picker aside until it connects.
              await releaseSuspension();
            }
          })());

        const userFriendlyAddress = toUserFriendlyAddress(
          wallet.account.address
        );

        return wagmiConnectResult(
          args?.withCapabilities,
          [userFriendlyAddress as Address],
          ton.id
        );
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

export const getTonConnectors = (
  options: TonConnectorOptions
): WalletList[number] => ({
  groupName: "Ton",
  wallets: [
    () => ({
      id: "tonconnect",
      name: "TonConnect",
      iconUrl: getWalletNetworkLogo("ton"),
      iconBackground: "transparent",
      availability: { _tag: "Remote" },
      chainGroup: {
        id: "ton",
        title: "Ton",
        iconUrl: getWalletNetworkLogo("ton"),
      },
      createConnector: (walletDetailsParams) =>
        createTonConnector(walletDetailsParams, options),
    }),
  ],
});
