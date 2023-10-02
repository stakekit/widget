import { Chain, Connector, mainnet } from "wagmi";
import { isLedgerDappBrowserProvider } from "../../utils";
import { Address, createWalletClient, custom } from "viem";
import { Wallet } from "@stakekit/rainbowkit";
import { EthereumProvider } from "eip1193-provider";
import {
  Account,
  Transport,
  WalletAPIClient,
  WindowMessageTransport,
} from "@ledgerhq/wallet-api-client";
import { fromBech32, toBech32 } from "@cosmjs/encoding";
import { CosmosNetworks } from "@stakekit/common";
import { isCosmosChain } from "../../domain";
import { cosmosChainsMap } from "../cosmos/chains";
import { near, solana, tezos } from "../misc/config";
import {
  SupportedLedgerLiveFamilies,
  SupportedLedgerLiveFamiliesMap,
} from "../../domain/types/chains";

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

  static readonly #skSupportedChains: SupportedLedgerLiveFamiliesMap = {
    ...(Object.fromEntries(
      Object.values(cosmosChainsMap).map(
        (c) =>
          [
            c.skChainName,
            { currencyFamily: c.skChainName, chain: c.wagmiChain },
          ] as const
      )
    ) as {
      [Key in keyof typeof cosmosChainsMap]: {
        currencyFamily: SupportedLedgerLiveFamilies;
        chain: Chain;
      };
    }),
    ethereum: { currencyFamily: "ethereum", chain: mainnet },
    near: { currencyFamily: "near", chain: near },
    tezos: { currencyFamily: "tezos", chain: tezos },
    solana: { currencyFamily: "solana", chain: solana },
  };

  static readonly #skSupportedChainsValues = Object.values(
    LedgerLiveConnector.#skSupportedChains
  );
  static readonly #skSupportedChainsKeys = Object.keys(
    LedgerLiveConnector.#skSupportedChains
  ) as (keyof SupportedLedgerLiveFamiliesMap)[];

  #currentChain: Chain | null = null;
  chains: Chain[];

  constructor() {
    const defaultChains = LedgerLiveConnector.#skSupportedChainsValues.map(
      (val) => val.chain
    );

    super({ chains: defaultChains, options: {} });

    this.chains = defaultChains;

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

    const walletApiClient = this.getWalletApiClient();

    const accounts = await walletApiClient.account.list({
      currencyIds: LedgerLiveConnector.#skSupportedChainsKeys,
    });

    this.#ledgerAccounts = accounts;
    this.#currentAccount = this.#ledgerAccounts[0];

    this.#currentChain =
      LedgerLiveConnector.#skSupportedChains[
        this.#currentAccount.currency as keyof SupportedLedgerLiveFamiliesMap
      ].chain;

    this.#accountsOnCurrentChain = this.#getAccountsOnCurrentChain();

    const accountsCurrencies = new Set(accounts.map((val) => val.currency));

    this.chains = LedgerLiveConnector.#skSupportedChainsValues
      .filter((val) =>
        isCosmosChain(val.chain)
          ? accountsCurrencies.has(CosmosNetworks.Cosmos)
          : accountsCurrencies.has(val.currencyFamily)
      )
      .map((val) => val.chain);

    const id = await this.getChainId();

    this.onAccountsChanged([this.#currentAccount.address as Address]);
    this.onChainChanged(this.#currentChain.id);

    return {
      account: this.#currentAccount.address as Address,
      chain: { id, unsupported: false },
    };
  }

  #getAccountsOnCurrentChain = () => {
    const currentChain = this.#currentChain;

    if (!currentChain) throw new Error("Current chain not found");

    if (isCosmosChain(currentChain)) {
      const bech32Prefix = Object.values(cosmosChainsMap).find(
        (c) => c.wagmiChain.id === currentChain.id
      )?.chain.bech32_prefix;

      if (!bech32Prefix) throw new Error("Bech32 prefix not found");

      return this.#ledgerAccounts
        .filter((a) => a.currency === CosmosNetworks.Cosmos)
        .map((a) => {
          const { data } = fromBech32(a.address);

          return {
            ...a,
            address: toBech32(bech32Prefix, data),
          };
        });
    } else {
      const supportedSkChain =
        LedgerLiveConnector.#skSupportedChainsValues.find(
          (c) => c.chain.id === currentChain.id
        );

      if (!supportedSkChain) throw new Error("SkSupported chain not found");

      return this.#ledgerAccounts.filter(
        (a) => a.currency === supportedSkChain.currencyFamily
      );
    }
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

  switchChain = async (chainId: number): Promise<Chain> => {
    const currentChain = this.#currentChain;

    if (!currentChain) throw new Error("Chain not found");

    const skSupportedChain = LedgerLiveConnector.#skSupportedChainsValues.find(
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
