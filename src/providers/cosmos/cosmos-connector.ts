import { wallets as keplrWallets } from "@cosmos-kit/keplr";
import { wallets as leapWallets } from "@cosmos-kit/leap";
import { WalletConnectWallet, walletConnectInfo } from "./wallet-connect";
import { Connector, CreateConnectorFn, createConnector } from "wagmi";
import { Wallet } from "@stakekit/rainbowkit";
import { toBase64 } from "@cosmjs/encoding";
import { getStorageItem, setStorageItem } from "../../services/local-storage";
import { Address, Chain } from "viem";
import { ConnectorWithFilteredChains } from "../../domain/types/connectors";
import { ChainWalletBase, MainWalletBase } from "@cosmos-kit/core";
import { CosmosChainsMap } from "../../domain/types/chains";
import { waitForMs } from "../../utils";
import { WCClient } from "@cosmos-kit/walletconnect";
import EventEmitter from "eventemitter3";
import { BehaviorSubject, Observable } from "rxjs";

export const wallets: MainWalletBase[] = [
  ...keplrWallets,
  ...leapWallets,
  new WalletConnectWallet(walletConnectInfo),
];

const configMeta = wallets.reduce(
  (acc, next) => {
    return {
      ...acc,
      wallets: {
        ...acc.wallets,
        [next.walletInfo.name]: {
          id: next.walletInfo.name,
          name: next.walletInfo.prettyName,
        },
      },
    };
  },
  { type: "cosmosProvider", wallets: {} } as {
    type: "cosmosProvider";
    wallets: Record<string, { id: string; name: string }>;
  }
);

type ExtraProps = ConnectorWithFilteredChains & {
  $chainWallet: Observable<ChainWalletBase>;
};

export type CosmosConnector = Connector & ExtraProps;

export const isCosmosConnector = (
  connector: Connector
): connector is CosmosConnector =>
  Object.values(configMeta.wallets).some((val) => val.id === connector.id);

export const createCosmosConnector = ({
  wallet,
  cosmosChainsMap,
  cosmosWagmiChains,
}: {
  wallet: MainWalletBase;
  cosmosChainsMap: Partial<CosmosChainsMap>;
  cosmosWagmiChains: Chain[];
}): Wallet => {
  return {
    id: wallet.walletInfo.name,
    name: wallet.walletInfo.prettyName,
    iconUrl:
      (typeof wallet.walletInfo.logo === "string"
        ? wallet.walletInfo.logo
        : wallet.walletInfo.logo?.major ?? wallet.walletInfo.logo?.minor) ?? "",
    iconBackground: "transparent",
    downloadUrls: {
      chrome: wallet.walletInfo.downloads?.[0].link,
      firefox: wallet.walletInfo.downloads?.[1].link,
      browserExtension: wallet.walletInfo.downloads?.[0].link,
    },
    qrCode: {
      getUri: (uri) => uri,
    },
    createConnector: (walletDetailsParams) =>
      createConnector<unknown, ExtraProps>((config) => {
        const provider = new EventEmitter();
        const $filteredChains = new BehaviorSubject(cosmosWagmiChains);
        const initCw = wallet.chainWalletMap.get(
          Object.values(cosmosChainsMap)[0].chain.chain_name
        );

        if (!initCw) throw new Error("Chain wallet not found");

        const $chainWallet = new BehaviorSubject<ChainWalletBase>(initCw);

        const setup: ReturnType<CreateConnectorFn>["setup"] = () =>
          new Promise((res, rej) => {
            let retryTimes = 0;

            const check = async () => {
              if (retryTimes > 3) {
                return rej();
              }

              if (
                initCw.clientMutable.state === "Done" ||
                initCw.clientMutable.state === "Error"
              ) {
                res();
              } else {
                await waitForMs(1000);
                retryTimes++;
                check();
              }
            };

            check();
          });

        const connect: ReturnType<CreateConnectorFn>["connect"] = async () => {
          config.emitter.emit("message", { type: "connecting" });

          const cw = $chainWallet.getValue();

          if (cw.address && cw.chainId) {
            if (cw.walletInfo.mode === "wallet-connect") {
              await (cw.client as WCClient).init();
            }

            return {
              accounts: [cw.address as Address],
              chainId: cw.chainId as unknown as number,
            };
          }

          const checkForQRCode = async (timesCheck: number) => {
            if (timesCheck <= 0) return;

            await waitForMs(400);

            if (cw.qrUrl.data) {
              return provider.emit("display_uri", cw.qrUrl.data);
            }

            checkForQRCode(--timesCheck);
          };

          if (cw.walletInfo.mode === "wallet-connect") {
            checkForQRCode(20);
          }

          await cw.connect();

          await getAndSavePubKeyToStorage();

          return {
            accounts: [cw.address as Address],
            chainId: cw.chainId as unknown as number,
          };
        };

        const getAndSavePubKeyToStorage = async () => {
          const cw = await $chainWallet.getValue();

          const result = await cw.client?.getAccount?.(cw.chainId);

          if (!result) return;

          const { address, pubkey } = result;

          const prevVal =
            getStorageItem("sk-widget@1//skPubKeys").orDefault({}) ?? {};

          setStorageItem("sk-widget@1//skPubKeys", {
            ...prevVal,
            [address]: toBase64(pubkey),
          });
        };

        const switchChain: ReturnType<CreateConnectorFn>["switchChain"] =
          async ({ chainId }) => {
            const wagmiChain = config.chains.find((c) => c.id === chainId);

            if (!wagmiChain) throw new Error("Chain not found");

            const cosmosChain = wagmiChain as Chain & {
              cosmosChainName: string;
            };

            const newCw = wallet.getChainWallet(
              cosmosChain.cosmosChainName
            ) as ChainWalletBase;

            if (!newCw) throw new Error("Chain wallet not found");

            $chainWallet.next(newCw);

            await connect();

            const chain = config.chains.find((c) => c.id === chainId);

            if (!chain) throw new Error("Chain not found");

            onChainChanged(chainId.toString());
            onAccountsChanged([newCw.address as Address]);

            return chain;
          };

        const onAccountsChanged: ReturnType<CreateConnectorFn>["onAccountsChanged"] =
          (accounts) => {
            if (accounts.length === 0) {
              config.emitter.emit("disconnect");
            } else {
              config.emitter.emit("change", {
                accounts: accounts as Address[],
              });
            }
          };

        const onChainChanged: ReturnType<CreateConnectorFn>["onChainChanged"] =
          (chainId) => {
            config.emitter.emit("change", {
              chainId: chainId as unknown as number,
            });
          };

        const onDisconnect: ReturnType<CreateConnectorFn>["onDisconnect"] =
          () => {
            config.emitter.emit("disconnect");
          };

        const getAccounts: ReturnType<CreateConnectorFn>["getAccounts"] =
          async () => {
            return [$chainWallet.getValue().address as Address];
          };

        const isAuthorized: ReturnType<CreateConnectorFn>["isAuthorized"] =
          async () => {
            try {
              return !!$chainWallet.getValue().address;
            } catch (error) {
              return false;
            }
          };

        const getChainId: ReturnType<CreateConnectorFn>["getChainId"] =
          async () => $chainWallet.getValue().chainId as unknown as number;

        const getProvider: ReturnType<CreateConnectorFn>["getProvider"] =
          async () => provider;

        const disconnect: ReturnType<CreateConnectorFn>["disconnect"] =
          async () => $chainWallet.getValue().disconnect();

        return {
          ...walletDetailsParams,
          setup,
          id: wallet.walletInfo.name,
          name: wallet.walletInfo.name,
          type: configMeta.type,
          $filteredChains: $filteredChains.asObservable(),
          $chainWallet: $chainWallet.asObservable(),
          connect,
          switchChain,
          onAccountsChanged,
          onChainChanged,
          onDisconnect,
          getAccounts,
          isAuthorized,
          getChainId,
          getProvider,
          disconnect,
        };
      }),
  };
};
