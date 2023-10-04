import { wallets as keplrWallets } from "@cosmos-kit/keplr";
import { wallets as leapWallets } from "@cosmos-kit/leap";
import { WalletConnectWallet, walletConnectInfo } from "./wallet-connect";
import { Address, Connector } from "wagmi";
import {
  ChainWalletBase,
  Logger,
  MainWalletBase,
  WalletManager,
} from "@cosmos-kit/core";
import { EthereumProvider } from "eip1193-provider";
import { createWalletClient, custom } from "viem";
import { Chain, Wallet } from "@stakekit/rainbowkit";
import { toBase64 } from "@cosmjs/encoding";
import { getStorageItem, setStorageItem } from "../../services/local-storage";
import { config } from "../../config";
import {
  typeSafeObjectEntries,
  typeSafeObjectFromEntries,
  waitForMs,
} from "../../utils";
import { WCClient } from "@cosmos-kit/walletconnect";
import { cosmosAssets } from "./chains/chain-registry";
import {
  CosmosChainsMap,
  supportedCosmosChains,
} from "../../domain/types/chains";
import {
  filteredCosmosChains,
  getWagmiChain,
  sKCosmosNetworksToRegistryIds,
} from "./chains";
import { getEnabledNetworks } from "../api/get-enabled-networks";
import { queryClient } from "../../services/query-client";
import { EitherAsync } from "purify-ts";
import { useQuery } from "@tanstack/react-query";

export const wallets = [
  ...keplrWallets,
  ...leapWallets,
  new WalletConnectWallet(walletConnectInfo),
];

type FilteredCosmosChainsMap = Partial<CosmosChainsMap>;

export class CosmosWagmiConnector extends Connector {
  readonly id: string;
  readonly name: string;

  ready = true;

  chainWallet: Promise<ChainWalletBase>;

  readonly provider = new EthereumProvider({} as any);

  readonly wallet: MainWalletBase;

  readonly cosmosChainsMap: FilteredCosmosChainsMap;
  readonly cosmosWagmiChains: Chain[];

  constructor(opts: {
    wallet: MainWalletBase;
    cosmosWagmiChains: Chain[];
    cosmosChainsMap: FilteredCosmosChainsMap;
  }) {
    super({ chains: opts.cosmosWagmiChains, options: {} });
    this.cosmosChainsMap = opts.cosmosChainsMap;
    this.cosmosWagmiChains = opts.cosmosWagmiChains;
    this.id = opts.wallet.walletInfo.name;
    this.name = opts.wallet.walletInfo.name;
    this.wallet = opts.wallet;

    this.chainWallet = new Promise((res, rej) => {
      let retryTimes = 0;

      const check = async () => {
        if (retryTimes > 3) {
          this.ready = false;
          return rej();
        }

        const cw = this.wallet.chainWalletMap.get(
          Object.values(opts.cosmosChainsMap)[0].chain.chain_name
        );

        if (cw && cw.clientMutable.state === "Done") {
          res(cw);
          this.ready = true;
        } else {
          await waitForMs(1000);
          retryTimes++;
          check();
        }
      };

      check();
    });
  }

  connect = async () => {
    setTimeout(() => this.emit("message", { type: "connecting" }), 0);

    const cw = await this.chainWallet;

    if (cw.address && cw.chainId) {
      if (cw.walletInfo.mode === "wallet-connect") {
        await (cw.client as WCClient).init();
      }

      return {
        account: cw.address as Address,
        chain: {
          id: cw.chainId as unknown as number,
          unsupported: false,
        },
      };
    }

    await cw.connect();

    await this.getAndSavePubKeyToStorage();

    return {
      account: cw.address as Address,
      chain: {
        id: cw.chainId as unknown as number,
        unsupported: false,
      },
    };
  };

  getAndSavePubKeyToStorage = async () => {
    if (typeof window === "undefined") return;

    const cw = await this.chainWallet;

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

  switchChain = async (chainId: number) => {
    const chainName = this.chains.find((c) => c.id === chainId)?.name;

    if (!chainName) throw new Error("Chain not found");

    const newCw = this.wallet.getChainWallet(chainName) as ChainWalletBase;

    if (!newCw) throw new Error("Wallet not found");

    this.chainWallet = Promise.resolve(newCw);
    await this.connect();

    const chain = this.chains.find((c) => c.id === chainId);

    if (!chain) throw new Error("Chain not found");

    this.provider.events.emit("chainChanged", chainId);
    this.onChainChanged(chainId);
    this.onAccountsChanged([newCw.address as Address]);

    return chain;
  };

  disconnect = async () => {
    (await this.chainWallet).disconnect();
  };
  getAccount = async () => {
    return (await this.chainWallet).address as Address;
  };
  isAuthorized = async () => {
    return !!(await this.chainWallet).address;
  };
  getChainId = async () =>
    (await this.chainWallet).chainId as unknown as number;

  getProvider = async () => this.provider;

  getWalletClient = async () => {
    const chainId = await this.getChainId();
    const chain = this.cosmosWagmiChains.find((c) => c.id === chainId)!;
    const provider = await this.getProvider();
    const account = await this.getAccount();

    return createWalletClient({
      account,
      chain,
      name: this.name,
      transport: custom(provider),
    });
  };

  protected onAccountsChanged = (accounts: string[]) => {
    if (accounts.length === 0) {
      this.emit("disconnect");
    } else {
      this.emit("change", { account: accounts[0] as Address });
    }
  };

  protected onChainChanged = (chainId: number | string) => {
    this.emit("change", {
      chain: { id: chainId as number, unsupported: false },
    });
  };

  protected onDisconnect = () => {
    this.emit("disconnect");
  };
}

const createCosmosConnector = ({
  wallet,
  cosmosChainsMap,
  cosmosWagmiChains,
}: {
  wallet: MainWalletBase;
  cosmosWagmiChains: Chain[];
  cosmosChainsMap: FilteredCosmosChainsMap;
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
    createConnector: () => {
      const connector = new CosmosWagmiConnector({
        wallet,
        cosmosChainsMap,
        cosmosWagmiChains,
      });

      return {
        connector,
        qrCode: {
          getUri: async () => {
            const cw = await connector.chainWallet;

            if (!cw.qrUrl || !cw.client) return "";

            return new Promise((res, rej) => {
              const timeoutId = setTimeout(() => {
                rej();
              }, 4000);

              // @ts-expect-error
              cw.client.setActions({
                qrUrl: {
                  state: () => {
                    clearTimeout(timeoutId);

                    const data = cw.qrUrl.data;
                    if (data) {
                      console.log("qrcode", data);
                      res(data);
                    }
                  },
                },
              });
            });
          },
        },
      };
    },
  };
};

const queryKey = [config.appPrefix, "cosmos-config"];
const staleTime = Infinity;

const queryFn = async () =>
  getEnabledNetworks().caseOf({
    Right: (networks) => {
      const cosmosChainsMap: FilteredCosmosChainsMap =
        typeSafeObjectFromEntries(
          typeSafeObjectEntries<CosmosChainsMap>(
            supportedCosmosChains.reduce((acc, next) => {
              const chain =
                filteredCosmosChains[sKCosmosNetworksToRegistryIds[next]];

              if (!chain) throw new Error("Chain not found");

              return {
                ...acc,
                [next]: {
                  type: "cosmos",
                  skChainName: next,
                  chain,
                  wagmiChain: getWagmiChain(chain),
                },
              };
            }, {} as CosmosChainsMap)
          ).filter(([_, v]) => networks.has(v.skChainName))
        );

      const cosmosWagmiChains = Object.values(cosmosChainsMap).map(
        (val) => val.wagmiChain
      );

      const connector = {
        groupName: "Cosmos",
        wallets: wallets.map((w) =>
          createCosmosConnector({
            wallet: w,
            cosmosChainsMap,
            cosmosWagmiChains,
          })
        ),
      };

      return Promise.resolve({
        cosmosChainsMap,
        cosmosWagmiChains,
        connector,
        cosmosWalletManager: new WalletManager(
          Object.values(cosmosChainsMap).map((c) => c.chain),
          cosmosAssets,
          wallets,
          new Logger("ERROR"),
          false,
          true,
          undefined,
          undefined,
          { signClient: { projectId: config.walletConnectV2.projectId } },
          undefined
        ),
      });
    },
    Left: (l) => Promise.reject(l),
  });

export const getConfig = () =>
  EitherAsync(() =>
    queryClient.fetchQuery({ staleTime, queryKey, queryFn })
  ).mapLeft((e) => {
    console.log(e);
    return new Error("Could not get cosmos config");
  });

export const useCosmosConfig = () => useQuery({ staleTime, queryKey, queryFn });
