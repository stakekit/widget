import {
  type Adapter,
  WalletNotFoundError,
  WalletReadyState,
} from "@tronweb3/tronwallet-abstract-adapter";
import { BitKeepAdapter } from "@tronweb3/tronwallet-adapter-bitkeep";
import { LedgerAdapter } from "@tronweb3/tronwallet-adapter-ledger";
import { TronLinkAdapter } from "@tronweb3/tronwallet-adapter-tronlink";
import { Effect, Schema, Stream } from "effect";
import type { Address } from "viem";
import { createConnector } from "wagmi";
import type {
  Chain,
  WalletChainGroup,
  WalletDetailsParams,
  WalletList,
} from "../../../wallet-descriptors";
import { WalletNotAvailableError } from "../../../wallet-errors";
import type { WalletConnectProtocol } from "../../platform/wallet-connect-protocol";
import {
  getWalletNetworkLogo,
  getWalletTokenLogo,
  walletImages,
} from "../../runtime/assets";
import type { RunWalletEffect } from "../../runtime/effect-runner";
import { tron } from "../configured-chains";
import { wagmiConnectResult } from "../wagmi-connect-result";
import { makeWagmiConnectorEvents } from "../wagmi-connector-events";
import type {
  ExtraProps,
  StorageItem,
  TronWallet,
} from "./tron-connector-meta";
import { configMeta } from "./tron-connector-meta";
import { makeTronWalletConnect } from "./tron-wallet-connect";

type TronAdapter = Pick<
  Adapter,
  | "address"
  | "connected"
  | "connect"
  | "disconnect"
  | "readyState"
  | "signTransaction"
>;

/** The providers the TronLink adapter accepts: TIP-1193 `window.tron` or legacy `window.tronLink`. */
const TronLinkProvider = Schema.Union([
  Schema.Struct({ tron: Schema.Struct({ isTronLink: Schema.Literal(true) }) }),
  Schema.Struct({ tronLink: Schema.Struct({}) }),
]);

/** The provider the Bitget adapter accepts (its `supportBitgetWallet` check). */
const BitgetProvider = Schema.Struct({
  isBitKeep: Schema.Literal(true),
  tronLink: Schema.Struct({}),
});

const adapterWallet = (
  adapter: () => TronAdapter,
  walletId: string
): TronWallet => ({
  address: () => adapter().address,
  connect: () =>
    adapter()
      .connect()
      .catch((error: unknown) => {
        if (error instanceof WalletNotFoundError) {
          throw new WalletNotAvailableError({ walletId });
        }
        throw error;
      }),
  disconnect: () => adapter().disconnect(),
  signTransaction: (transaction) => adapter().signTransaction(transaction),
  isAuthorized: async () => adapter().connected && !!adapter().address,
});

const createTronConnector = ({
  wallet,
  metaConfig,
  walletDetailsParams,
}: {
  metaConfig: keyof typeof configMeta;
  wallet: TronWallet;
  walletDetailsParams: WalletDetailsParams;
}) =>
  createConnector<unknown, ExtraProps, StorageItem>((config) => {
    wallet.onEnded?.(() => config.emitter.emit("disconnect"));
    const accounts = () => {
      const address = wallet.address();
      if (!address) throw new Error("No account found");
      return [address as Address];
    };
    return {
      ...walletDetailsParams,
      id: configMeta[metaConfig].id,
      name: configMeta[metaConfig].name,
      type: configMeta[metaConfig].type,
      signTransaction: wallet.signTransaction,
      connect: async (args) => {
        config.emitter.emit("message", { type: "connecting" });

        await wallet.connect({ isReconnecting: args?.isReconnecting ?? false });

        config.storage?.removeItem("tron.disconnected");

        return wagmiConnectResult(args?.withCapabilities, accounts(), tron.id);
      },
      disconnect: () => {
        config.storage?.setItem("tron.disconnected", true);
        return wallet.disconnect();
      },
      getAccounts: async () => accounts(),
      switchChain: async () => tron,
      getChainId: async () => tron.id,
      isAuthorized: async () => {
        const isDisconnected =
          await config.storage?.getItem("tron.disconnected");

        if (isDisconnected) return false;

        return wallet.isAuthorized();
      },
      ...makeWagmiConnectorEvents(config.emitter),
      getProvider: async () => wallet,
      $filteredChains: Stream.succeed<Chain[]>([tron]),
    };
  });

export const getTronConnectors = ({
  walletConnectProtocol,
  runWalletEffect,
}: {
  readonly walletConnectProtocol: WalletConnectProtocol;
  readonly runWalletEffect: RunWalletEffect;
}): WalletList[number] => {
  const tronChainGroup = {
    iconUrl: getWalletNetworkLogo("tron"),
    title: "Tron",
    id: "tron",
  } satisfies WalletChainGroup;

  const extension =
    ({
      metaConfig,
      iconUrl,
      installUrl,
      isInjected,
      makeAdapter,
    }: {
      readonly metaConfig: "tronLink" | "tronBg";
      readonly iconUrl: string;
      readonly installUrl: string;
      readonly isInjected: (page: unknown) => boolean;
      readonly makeAdapter: () => TronAdapter;
    }): WalletList[number]["wallets"][number] =>
    () => {
      let adapter = makeAdapter();
      // The adapters stop discovery after their first timeout, so one that
      // gave up never sees an extension installed or enabled later.
      const currentAdapter = () => {
        if (
          adapter.readyState === WalletReadyState.NotFound &&
          isInjected(globalThis)
        ) {
          adapter = makeAdapter();
        }
        return adapter;
      };
      return {
        id: configMeta[metaConfig].id,
        name: configMeta[metaConfig].name,
        iconUrl,
        iconBackground: "#fff",
        chainGroup: tronChainGroup,
        availability: {
          _tag: "Injected",
          detect: Effect.sync(
            () =>
              adapter.readyState === WalletReadyState.Found ||
              isInjected(globalThis)
          ),
          installUrl,
        },
        createConnector: (walletDetailsParams) =>
          createTronConnector({
            walletDetailsParams,
            metaConfig,
            wallet: adapterWallet(currentAdapter, configMeta[metaConfig].id),
          }),
      };
    };

  // The picker offers the store page instead of the adapters opening a tab.
  const adapterConfig = { openUrlWhenWalletNotFound: false };

  return {
    groupName: "Tron",
    wallets: [
      extension({
        metaConfig: "tronLink",
        iconUrl: getWalletTokenLogo("trx"),
        installUrl:
          "https://chromewebstore.google.com/detail/tronlink/ibnejdfjmmkpcnlpebklmnkoeoihofec",
        isInjected: Schema.is(TronLinkProvider),
        makeAdapter: () => new TronLinkAdapter(adapterConfig),
      }),
      () => ({
        id: configMeta.tronWc.id,
        name: configMeta.tronWc.name,
        iconUrl: walletImages.wcLogo,
        iconBackground: "#fff",
        availability: { _tag: "Remote" },
        chainGroup: tronChainGroup,
        createConnector: (walletDetailsParams) =>
          createTronConnector({
            walletDetailsParams,
            metaConfig: "tronWc",
            wallet: makeTronWalletConnect({
              walletConnectProtocol,
              runWalletEffect,
            }),
          }),
      }),
      extension({
        metaConfig: "tronBg",
        iconUrl: walletImages.bitget,
        installUrl:
          "https://chromewebstore.google.com/detail/bitget-wallet-crypto-web3/jiidiaalihmmhddjgbnbgdfflelocpak",
        isInjected: Schema.is(BitgetProvider),
        makeAdapter: () => new BitKeepAdapter(adapterConfig),
      }),
      () => ({
        id: configMeta.tronLedger.id,
        name: configMeta.tronLedger.name,
        iconUrl: walletImages.ledgerLogo,
        iconBackground: "#fff",
        availability: { _tag: "Remote" },
        chainGroup: tronChainGroup,
        createConnector: (walletDetailsParams) => {
          const ledger = new LedgerAdapter();
          return createTronConnector({
            walletDetailsParams,
            metaConfig: "tronLedger",
            wallet: adapterWallet(() => ledger, configMeta.tronLedger.id),
          });
        },
      }),
    ],
  };
};
