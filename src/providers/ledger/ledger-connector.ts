import { Connector } from "wagmi";
import { isLedgerDappBrowserProvider } from "../../utils";
import { Address, createWalletClient, custom } from "viem";
import { Chain, Wallet } from "@stakekit/rainbowkit";
import { EthereumProvider } from "eip1193-provider";
import {
  Account,
  Transport,
  WalletAPIClient,
  WindowMessageTransport,
} from "@ledgerhq/wallet-api-client";
import { CosmosNetworks, EvmNetworks, MiscNetworks } from "@stakekit/common";
import {
  AllSupportedLedgerLiveFamiliesMap,
  CosmosChainsMap,
  EvmChainsMap,
  FilteredSupportedLedgerLiveFamiliesMap,
  MiscChainsMap,
} from "../../domain/types/chains";
import { getWagmiConfig } from "../wagmi";

export class LedgerLiveConnector extends Connector {
  readonly id = "ledgerLive";
  readonly name = "Ledger Live";
  readonly ready: boolean;

  #provider = new EthereumProvider({} as any);

  #walletApiClient?: WalletAPIClient;
  #transport?: Transport;

  #ledgerAccounts: Account[] = [];
  #accountsOnCurrentChain: Account[] = [];
  #currentAccount?: Account;

  #filteredSkSupportedChainsValues:
    | {
        currencyFamily: NonNullable<
          FilteredSupportedLedgerLiveFamiliesMap[keyof FilteredSupportedLedgerLiveFamiliesMap]
        >["currencyFamily"];
        chain: Chain;
      }[]
    | null = null;

  #currentChain: Chain | null = null;

  constructor() {
    super({ options: {} });

    if (!isLedgerDappBrowserProvider()) {
      this.ready = false;
      return;
    }

    const transport = new WindowMessageTransport();
    this.#transport = transport;
    transport.connect();

    this.#walletApiClient = new WalletAPIClient(this.#transport);

    this.ready = true;
  }

  getCurrentAccountId = () => {
    console.log("current account:", this.#currentAccount);
    return this.#currentAccount?.id;
  };

  getAccountsOnCurrentChain = () => this.#accountsOnCurrentChain;

  getWalletApiClient = () => {
    if (!this.#walletApiClient) throw new Error("Wallet API Client not found.");
    return this.#walletApiClient;
  };

  async connect() {
    this.emit("message", { type: "connecting" });

    const wagmiConfig = (await getWagmiConfig()).extract();

    if (wagmiConfig instanceof Error) throw wagmiConfig;

    // Filter default supported chains with chains from API, and add `chain` from wagmiConfig
    const filteredSkSupportedChainsMap = Object.values({
      ethereum: {
        currencyFamily: "ethereum",
        skChainName: EvmNetworks.Ethereum,
      },
      celo: { currencyFamily: "celo", skChainName: EvmNetworks.Celo },
      cosmos: { currencyFamily: "cosmos", skChainName: CosmosNetworks.Cosmos },
      crypto_org: {
        currencyFamily: "crypto_org",
        skChainName: CosmosNetworks.Cronos,
      },
      near: { currencyFamily: "near", skChainName: MiscNetworks.Near },
      solana: { currencyFamily: "solana", skChainName: MiscNetworks.Solana },
      tezos: { currencyFamily: "tezos", skChainName: MiscNetworks.Tezos },
    } satisfies AllSupportedLedgerLiveFamiliesMap).reduce(
      (acc, next) => {
        const chain =
          wagmiConfig.evmConfig.evmChainsMap[
            next.skChainName as EvmChainsMap[keyof EvmChainsMap]["skChainName"]
          ]?.wagmiChain ||
          wagmiConfig.cosmosConfig.cosmosChainsMap[
            next.skChainName as CosmosChainsMap[keyof CosmosChainsMap]["skChainName"]
          ]?.wagmiChain ||
          wagmiConfig.miscConfig.miscChainsMap[
            next.skChainName as MiscChainsMap[keyof MiscChainsMap]["skChainName"]
          ]?.wagmiChain;

        if (chain) {
          return { ...acc, [next.currencyFamily]: { ...next, chain } };
        }

        return acc;
      },
      {} as {
        [Key in keyof FilteredSupportedLedgerLiveFamiliesMap]: FilteredSupportedLedgerLiveFamiliesMap[Key] & {
          chain: Chain;
        };
      }
    );

    const accounts = await this.getWalletApiClient().account.list({
      currencyIds: Object.keys(
        filteredSkSupportedChainsMap
      ) as (keyof FilteredSupportedLedgerLiveFamiliesMap)[],
    });

    const familiesSet = new Set(accounts.map((a) => a.currency));

    // Filter again with supported chains from ledger
    this.#filteredSkSupportedChainsValues = Object.values(
      filteredSkSupportedChainsMap
    ).reduce(
      (acc, next) => {
        if (familiesSet.has(next.currencyFamily)) {
          return [...acc, next];
        }

        return acc;
      },
      [] as {
        currencyFamily: NonNullable<
          FilteredSupportedLedgerLiveFamiliesMap[keyof FilteredSupportedLedgerLiveFamiliesMap]
        >["currencyFamily"];
        chain: Chain;
      }[]
    );

    // Set chains to expose for switcher
    // @ts-expect-error
    this.chains = this.#filteredSkSupportedChainsValues.map((val) => val.chain);

    this.#ledgerAccounts = accounts;
    this.#currentAccount = this.#ledgerAccounts[0];

    this.#currentChain =
      filteredSkSupportedChainsMap[
        this.#currentAccount
          .currency as keyof FilteredSupportedLedgerLiveFamiliesMap
      ]!.chain;

    this.#accountsOnCurrentChain = this.#getAccountsOnCurrentChain();

    this.onAccountsChanged([this.#currentAccount.address as Address]);
    this.onChainChanged(this.#currentChain.id);

    return {
      account: this.#currentAccount.address as Address,
      chain: { id: await this.getChainId(), unsupported: false },
    };
  }

  #getAccountsOnCurrentChain = () => {
    const currentChain = this.#currentChain;

    if (!currentChain) throw new Error("Current chain not found");

    const supportedSkChain = this.#filteredSkSupportedChainsValues!.find(
      (c) => c.chain.id === currentChain.id
    );

    if (!supportedSkChain) throw new Error("SkSupported chain not found");

    return this.#ledgerAccounts.filter(
      (a) => a.currency === supportedSkChain.currencyFamily
    );
  };

  async disconnect() {
    // @ts-ignore
    return this.#transport?.disconnect?.();
  }

  async getAccount() {
    return this.#currentAccount?.address as Address;
  }

  async getChainId() {
    const id = this.#currentChain?.id;

    if (!id) throw new Error("Chain not found");

    return id;
  }

  async getProvider() {
    return this.#provider;
  }

  getWalletClient = async () => {
    return createWalletClient({
      account: this.#currentAccount?.address as Address,
      chain: this.#currentChain!,
      transport: custom(this.#provider),
    });
  };

  switchAccount = (account: Account) => {
    this.#currentAccount = account;
    this.onAccountsChanged([this.#currentAccount.address as Address]);
  };

  switchChain = async (chainId: number): Promise<Chain> => {
    const currentChain = this.#currentChain;

    if (!currentChain) throw new Error("Chain not found");

    const skSupportedChain = this.#filteredSkSupportedChainsValues!.find(
      (c) => c.chain.id === chainId
    );

    if (!skSupportedChain) throw new Error("Chain not found");

    if (currentChain.id !== skSupportedChain.chain.id) {
      this.#currentChain = skSupportedChain.chain;
      this.#accountsOnCurrentChain = this.#getAccountsOnCurrentChain();
      this.#currentAccount = this.#accountsOnCurrentChain[0];
    }

    const currentAccount = this.#currentAccount;

    if (!currentAccount) throw new Error("Account not found");

    this.#provider.events.emit("chainChanged", chainId);
    this.onChainChanged(chainId);
    this.onAccountsChanged([currentAccount.address as Address]);

    return skSupportedChain.chain;
  };

  async isAuthorized() {
    return isLedgerDappBrowserProvider();
  }

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
  protected onDisconnect(error: Error): void {
    this.emit("disconnect");
  }
}

const ledgerLive = (): Wallet => {
  return {
    id: "ledgerLive",
    name: "Ledger Live",
    iconUrl: async () =>
      "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyOCIgaGVpZ2h0PSIyOCIgZmlsbD0ibm9uZSI+PHBhdGggZmlsbD0iIzAwMCIgZD0iTTAgMGgyOHYyOEgweiIvPjxwYXRoIGZpbGw9IiNmZmYiIGZpbGwtcnVsZT0iZXZlbm9kZCIgZD0iTTExLjY1IDQuNEg0LjRWOWgxLjFWNS41bDYuMTUtLjA0VjQuNFptLjA1IDUuOTV2Ny4yNWg0LjZ2LTEuMWgtMy41bC0uMDQtNi4xNUgxMS43Wk00LjQgMjMuNmg3LjI1di0xLjA2TDUuNSAyMi41VjE5SDQuNHY0LjZaTTE2LjM1IDQuNGg3LjI1VjloLTEuMVY1LjVsLTYuMTUtLjA0VjQuNFptNy4yNSAxOS4yaC03LjI1di0xLjA2bDYuMTUtLjA0VjE5aDEuMXY0LjZaIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiLz48L3N2Zz4=",
    iconBackground: "#fff",
    hidden: () => !isLedgerDappBrowserProvider(),
    createConnector: () => ({
      connector: new LedgerLiveConnector(),
    }),
  };
};

export const ledgerLiveConnector = {
  groupName: "Ledger Live",
  wallets: [ledgerLive()],
};
