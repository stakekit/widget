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
import { Effect, Schema, Stream } from "effect";
import type { Address, Chain } from "viem";
import { createConnector } from "wagmi";
import { ton } from "../../domain/types/chains/misc";
import { MiscNetworks } from "../../domain/types/chains/networks";
import { unsignedTonTransactionTonConnectCodec } from "../../domain/types/transaction";
import { getNetworkLogo } from "../../utils";
import {
  configMeta,
  type ExtraProps,
  type StorageItem,
} from "./ton-connector-meta";

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
            return yield* Effect.fail(new Error("No wallet connected"));
          }

          const { message } = yield* Schema.decodeEffect(
            Schema.fromJsonString(unsignedTonTransactionTonConnectCodec)
          )(tx).pipe(Effect.mapError((error) => new Error(error.message)));
          const parsedTx = yield* Effect.try({
            try: () =>
              loadMessageRelaxed(Cell.fromBase64(message).beginParse()),
            catch: (error) => new Error(String(error)),
          });

          const info = parsedTx.info as CommonMessageInfoRelaxedInternal;

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
                validUntil: Date.now() + 1000 * 60 * 60 * 24,
              }),
            catch: (error) =>
              error instanceof Error ? error : new Error(String(error)),
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
      iconUrl: getNetworkLogo(MiscNetworks.Ton),
      iconBackground: "transparent",
      chainGroup: {
        id: "ton",
        title: "Ton",
        iconUrl: getNetworkLogo(MiscNetworks.Ton),
      },
      createConnector: (walletDetailsParams) =>
        createTonConnector(walletDetailsParams, tonConnectManifestUrl),
    }),
  ],
});
