import { BrowserWallet } from "@meshsdk/wallet";
import { Effect, Stream } from "effect";
import type { Address, Chain } from "viem";
import { createConnector } from "wagmi";
import type {
  WalletDetailsParams,
  WalletList,
} from "../../../wallet-descriptors";
import {
  WalletIntegrationError,
  WalletNotAvailableError,
} from "../../../wallet-errors";
import { getWalletNetworkLogo } from "../../runtime/assets";
import { cardano } from "../configured-chains";
import { wagmiConnectResult } from "../wagmi-connect-result";
import { makeWagmiConnectorEvents } from "../wagmi-connector-events";
import {
  configMeta,
  type ExtraProps,
  type StorageItem,
} from "./cardano-connector-meta";
// Wallet logos from the wallets' Chrome Web Store listings, bundled because
// the store's image CDN rate-limits hotlinked requests.
import eternlIcon from "./icons/eternl.png";
import laceIcon from "./icons/lace.png";
import typhonIcon from "./icons/typhon.png";
import vesprIcon from "./icons/vespr.png";
import yoroiIcon from "./icons/yoroi.png";

type CardanoWallet = Readonly<{
  id: string;
  name: string;
  iconUrl: string;
  installUrl?: string;
}>;

/**
 * Well-known CIP-30 extension wallets, offered before any is installed.
 * Ids are their `window.cardano` keys, which Mesh's `BrowserWallet` enables.
 */
const catalogue: ReadonlyArray<CardanoWallet> = [
  {
    id: "eternl",
    name: "Eternl",
    iconUrl: eternlIcon,
    installUrl:
      "https://chromewebstore.google.com/detail/eternl/kmhcihpebfmpgmihbkipmjlmmioameka",
  },
  {
    id: "lace",
    name: "Lace",
    iconUrl: laceIcon,
    installUrl:
      "https://chromewebstore.google.com/detail/lace/gafhhkghbfjjkeiendhlofajokpaflmk",
  },
  {
    id: "yoroi",
    name: "Yoroi",
    iconUrl: yoroiIcon,
    installUrl:
      "https://chromewebstore.google.com/detail/secondfi-yoroi/ffnbelfdoeiohenkjibnmadjiehjhajb",
  },
  {
    id: "typhoncip30",
    name: "Typhon",
    iconUrl: typhonIcon,
    installUrl:
      "https://chromewebstore.google.com/detail/typhon-wallet/kfdniefadaanbjodldohaedphafoffoh",
  },
  {
    id: "vespr",
    name: "VESPR",
    iconUrl: vesprIcon,
    installUrl:
      "https://chromewebstore.google.com/detail/vespr-wallet/bedogdpgdnifilpgeianmmdabklhfkcn",
  },
];

/** Whether the extension has injected its CIP-30 provider, per Mesh. */
const isInjected = (id: string) =>
  BrowserWallet.getInstalledWallets().some((wallet) => wallet.id === id);

const createCardanoConnector = ({
  wallet,
  walletDetailsParams,
}: {
  wallet: CardanoWallet;
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
        connectedWallet
          ? Effect.tryPromise({
              try: () => connectedWallet!.signTx(tx),
              catch: (cause) =>
                new WalletIntegrationError({
                  cause,
                  message:
                    cause instanceof Error ? cause.message : String(cause),
                  operation: "cardano-sign-transaction",
                }),
            })
          : Effect.fail(
              new WalletIntegrationError({
                message: "No wallet connected",
                operation: "cardano-sign-transaction",
              })
            ),
      connect: async (args) => {
        config.emitter.emit("message", { type: "connecting" });

        config.storage?.removeItem("cardano.disconnected");

        if (!isInjected(wallet.id)) {
          throw new WalletNotAvailableError({ walletId: wallet.id });
        }
        connectedWallet = await BrowserWallet.enable(wallet.id);

        const address = await connectedWallet
          .getUsedAddress()
          .then((address) => address.toBech32());

        config.storage?.setItem("cardano.lastConnectedWallet", {
          address,
          id: wallet.id,
        });

        return wagmiConnectResult(
          args?.withCapabilities,
          [address as Address],
          cardano.id
        );
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
      ...makeWagmiConnectorEvents(config.emitter),
      getProvider: async () => ({}),
      $filteredChains: Stream.succeed<Chain[]>([cardano]),
    };
  });

export const getCardanoConnectors = (): WalletList[number] => {
  const detected = BrowserWallet.getInstalledWallets().map(
    (wallet): CardanoWallet => ({
      id: wallet.id,
      name: wallet.name,
      iconUrl: wallet.icon,
      installUrl: catalogue.find(({ id }) => id === wallet.id)?.installUrl,
    })
  );
  const listed = [
    ...detected,
    ...catalogue.filter(
      ({ id }) => !detected.some((wallet) => wallet.id === id)
    ),
  ];

  return {
    groupName: "Cardano",
    wallets: listed.map((wallet) => () => ({
      id: wallet.id,
      name: wallet.name,
      iconUrl: wallet.iconUrl,
      iconBackground: "#fff",
      availability: {
        _tag: "Injected",
        detect: Effect.sync(() => isInjected(wallet.id)),
        installUrl: wallet.installUrl,
      },
      chainGroup: {
        id: "cardano",
        title: "Cardano",
        iconUrl: getWalletNetworkLogo("cardano"),
      },
      createConnector: (walletDetailsParams) =>
        createCardanoConnector({ wallet, walletDetailsParams }),
    })),
  };
};
