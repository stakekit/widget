import { Connector, createConnector, normalizeChainId } from "wagmi";
import { Adapter } from "@tronweb3/tronwallet-abstract-adapter";
import { TronLinkAdapter } from "@tronweb3/tronwallet-adapter-tronlink";
import { WalletConnectAdapter } from "@tronweb3/tronwallet-adapter-walletconnect";
import { BitKeepAdapter } from "@tronweb3/tronwallet-adapter-bitkeep";
import { LedgerAdapter } from "@tronweb3/tronwallet-adapter-ledger";
import { EitherAsync, Maybe } from "purify-ts";
import { tron } from "./chains";
import { getTokenLogo } from "../../utils";
import { getStorageItem, setStorageItem } from "../../services/local-storage";
import { config } from "../../config";
import { Chain, WalletDetailsParams, WalletList } from "@stakekit/rainbowkit";
import { wcLogo } from "../../assets/images/wc-logo";
import bitget from "../../assets/images/bitget.png";
import { ledger } from "../../assets/images/ledger";
import { Address } from "viem";
import { ConnectorWithFilteredChains } from "../../domain/types/connectors";
import { Observable } from "../../utils/observable";

const configMeta = {
  tronLink: {
    id: "tronLink",
    name: "TronLink",
    type: "tronLinkProvider",
  },
  tronWc: {
    id: "tronWc",
    name: "Wallet Connect",
    type: "tronWcProvider",
  },
  tronBg: {
    id: "tronBg",
    name: "Bitget",
    type: "tronBgProvider",
  },
  tronLedger: {
    id: "tronLedger",
    name: "Ledger",
    type: "tronLedgerProvider",
  },
} as const;

type ExtraProps = ConnectorWithFilteredChains &
  Pick<Adapter, "signTransaction">;

type TronConnector = Connector & ExtraProps;

export const isTronConnector = (
  connector: Connector
): connector is TronConnector =>
  Object.values(configMeta).some((val) => val.id === connector.id);

const createTronConnector = ({
  adapter,
  metaConfig,
  walletDetailsParams,
}: {
  metaConfig: keyof typeof configMeta;
  adapter: Adapter;
  walletDetailsParams: WalletDetailsParams;
}) =>
  createConnector<unknown, ExtraProps>((config) => ({
    ...walletDetailsParams,
    id: configMeta[metaConfig].id,
    name: configMeta[metaConfig].name,
    type: configMeta[metaConfig].type,
    signTransaction: adapter.signTransaction.bind(adapter),
    connect: async () => {
      config.emitter.emit("message", { type: "connecting" });

      await adapter.connect();

      setStorageItem("sk-widget@1//shimDisconnect/tron", true);

      return {
        accounts: [adapter.address as Address],
        chainId: tron.id,
      };
    },
    disconnect: () => {
      setStorageItem("sk-widget@1//shimDisconnect/tron", false);
      return adapter.disconnect();
    },
    getAccounts: async () => {
      return (
        await EitherAsync.liftEither(
          Maybe.fromNullable([adapter.address as Address]).toEither(
            new Error("No account found")
          )
        )
      ).unsafeCoerce();
    },
    switchChain: async () => tron,
    getChainId: async () => tron.id,
    isAuthorized: async () =>
      getStorageItem("sk-widget@1//shimDisconnect/tron")
        .map((val) => !!(val && adapter.connected && adapter.address))
        .orDefault(false),
    onAccountsChanged: (accounts: string[]) => {
      if (accounts.length === 0) {
        config.emitter.emit("disconnect");
      } else {
        config.emitter.emit("change", { accounts: accounts as Address[] });
      }
    },
    onChainChanged: (chainId) => {
      config.emitter.emit("change", { chainId: normalizeChainId(chainId) });
    },
    onDisconnect: () => {
      config.emitter.emit("disconnect");
    },
    getProvider: async () => ({}),
    $filteredChains: new Observable<Chain[]>([tron]),
  }));

export const tronConnector: WalletList[number] = {
  groupName: "Tron",
  wallets: [
    () => ({
      id: configMeta.tronLink.id,
      name: configMeta.tronLink.name,
      iconUrl: getTokenLogo("trx"),
      iconBackground: "#fff",
      createConnector: (walletDetailsParams) =>
        createTronConnector({
          walletDetailsParams,
          metaConfig: "tronLink",
          adapter: new TronLinkAdapter(),
        }),
    }),
    () => ({
      id: configMeta.tronWc.id,
      name: configMeta.tronWc.name,
      iconUrl: wcLogo,
      iconBackground: "#fff",
      installed: true,
      createConnector: (walletDetailsParams) =>
        createTronConnector({
          walletDetailsParams,
          metaConfig: "tronWc",
          adapter: new WalletConnectAdapter({
            network: "Mainnet",
            options: {
              customStoragePrefix: "tronwalletconnect_",
              projectId: config.walletConnectV2.projectId,
            },
            web3ModalConfig: {
              themeVariables: { "--w3m-z-index": "99999999999" },
            },
          }),
        }),
    }),
    () => ({
      id: configMeta.tronBg.id,
      name: configMeta.tronBg.name,
      iconUrl: bitget,
      iconBackground: "#fff",
      createConnector: (walletDetailsParams) =>
        createTronConnector({
          walletDetailsParams,
          adapter: new BitKeepAdapter(),
          metaConfig: "tronBg",
        }),
    }),
    () => ({
      id: configMeta.tronLedger.id,
      name: configMeta.tronLedger.name,
      iconUrl: ledger,
      iconBackground: "#fff",
      createConnector: (walletDetailsParams) =>
        createTronConnector({
          walletDetailsParams,
          metaConfig: "tronLedger",
          adapter: new LedgerAdapter(),
        }),
    }),
  ],
};
