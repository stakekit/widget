import { CosmosNetworks } from "@stakekit/common";
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
import { Wallet } from "@stakekit/rainbowkit";
import { toBase64 } from "@cosmjs/encoding";
import { getStorageItem, setStorageItem } from "../../services/local-storage";
import { cosmosChainsMap } from "./chains";
import { config } from "../../config";
import { waitForMs } from "../../utils";
import { WCClient } from "@cosmos-kit/walletconnect";
import { cosmosAssets } from "./chains/chain-registry";

export const wallets = [
  ...keplrWallets,
  ...leapWallets,
  new WalletConnectWallet(walletConnectInfo),
];

export const cosmosWagmiChains = Object.values(cosmosChainsMap).map(
  (c) => c.wagmiChain
);

export class CosmosWagmiConnector extends Connector {
  readonly id: string;
  readonly name: string;

  ready = true;

  chainWallet: Promise<ChainWalletBase>;

  readonly provider = new EthereumProvider({} as any);

  readonly wallet: MainWalletBase;

  constructor(opts: { wallet: MainWalletBase }) {
    super({ chains: cosmosWagmiChains, options: {} });
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
          cosmosChainsMap[CosmosNetworks.Cosmos].chain.chain_name
        )!;
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
    const chain = cosmosWagmiChains.find((c) => c.id === chainId)!;
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

export const createCosmosConnector = ({
  wallet,
}: {
  wallet: MainWalletBase;
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
      const connector = new CosmosWagmiConnector({ wallet });

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

export const connector = {
  groupName: "Cosmos",
  wallets: wallets.map((w) => createCosmosConnector({ wallet: w })),
};

export const cosmosWalletManager = new WalletManager(
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
);
