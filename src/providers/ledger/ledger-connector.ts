import { Connector } from "wagmi";
import { assertNotError, isLedgerDappBrowserProvider } from "../../utils";
import { Address, createWalletClient, custom } from "viem";
import { Chain, Wallet } from "@stakekit/rainbowkit";
import { EthereumProvider } from "eip1193-provider";
import {
  Account,
  Transport,
  WalletAPIClient,
  WindowMessageTransport,
} from "@ledgerhq/wallet-api-client";
import {
  SupportedLedgerLiveFamilies,
  SupportedSKChains,
} from "../../domain/types/chains";
import { getWagmiConfig } from "../wagmi";
import { EitherAsync, List, Maybe } from "purify-ts";
import {
  getFilteredSupportedLedgerFamiliesWithCurrency,
  getLedgerCurrencies,
} from "./utils";
import { GetEitherAsyncRight } from "../../types";
import { getInitParams } from "../../common/get-init-params";

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

  #filteredSkSupportedChainsValues: GetEitherAsyncRight<
    ReturnType<typeof getFilteredSupportedLedgerFamiliesWithCurrency>
  > | null = null;

  #currentChain: ChainItem | null = null;

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
    return this.#currentAccount?.id;
  };

  getAccountsOnCurrentChain = () => this.#accountsOnCurrentChain;

  getWalletApiClient = () => {
    if (!this.#walletApiClient) throw new Error("Wallet API Client not found.");
    return this.#walletApiClient;
  };

  async connect() {
    this.emit("message", { type: "connecting" });

    /**
     * Create Map<CryptoCurrency['id'], CryptoCurrency['family']>
     * then use TokenCurrency parent to get CryptoCurrency family
     * and add to map TokenCurrency['id'] => CryptoCurrency['family']
     */
    const ledgerCurrencies = (
      await getLedgerCurrencies(this.getWalletApiClient())
    ).extract();

    assertNotError(ledgerCurrencies);

    const accounts = (
      await EitherAsync(() => this.getWalletApiClient().account.list()).mapLeft(
        (e) => {
          console.log(e);
          return new Error("could not get accounts");
        }
      )
    ).extract();

    assertNotError(accounts);

    const filteredSupportedLedgerFamiliesWithCurrency = (
      await getFilteredSupportedLedgerFamiliesWithCurrency({
        ledgerCurrencies,
        accounts,
      })
    ).extract();

    assertNotError(filteredSupportedLedgerFamiliesWithCurrency);

    this.#filteredSkSupportedChainsValues =
      filteredSupportedLedgerFamiliesWithCurrency;

    const wagmiConfig = (
      await getWagmiConfig({ forceWalletConnectOnly: false })
    ).extract();

    assertNotError(wagmiConfig);

    // Set chains to expose for switcher
    // @ts-expect-error
    this.chains = [
      ...filteredSupportedLedgerFamiliesWithCurrency.values(),
    ].reduce((acc, next) => {
      [...next.values()].forEach((v) => {
        acc.push(v.chain);
      });

      return acc;
    }, [] as Chain[]);

    this.#ledgerAccounts = accounts;

    const accountsWithChain = accounts.reduce(
      (acc, next) => {
        const family = ledgerCurrencies.get(next.currency);

        if (!family) return acc;

        const itemMap = filteredSupportedLedgerFamiliesWithCurrency.get(
          family as SupportedLedgerLiveFamilies
        );

        if (!family || !itemMap) return acc;

        const chainItem = itemMap.get("*") || itemMap.get(next.currency);

        if (chainItem) {
          acc.push({ account: next, chainItem });
        }

        return acc;
      },
      [] as { account: Account; chainItem: ChainItem }[]
    );

    const accountWithChain = Maybe.fromNullable(getInitParams().network)
      .chain((val) =>
        List.find((v) => v.chainItem.skChainName === val, accountsWithChain)
      )
      .altLazy(() => List.head(accountsWithChain))
      .toEither(new Error("Account not found"))
      .extract();

    assertNotError(accountWithChain);

    this.#currentAccount = accountWithChain.account;
    this.#currentChain = accountWithChain.chainItem;
    this.#accountsOnCurrentChain = this.#getAccountsOnCurrentChain();

    this.onAccountsChanged([this.#currentAccount.address as Address]);
    this.onChainChanged(this.#currentChain.chain.id);

    return {
      account: this.#currentAccount.address as Address,
      chain: { id: await this.getChainId(), unsupported: false },
    };
  }

  #getAccountsOnCurrentChain = () => {
    const currentChain = this.#currentChain;

    if (!currentChain) throw new Error("Current chain not found");

    return this.#ledgerAccounts.filter(
      (a) => a.currency === currentChain.currencyId
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
    const id = this.#currentChain?.chain.id;

    if (!id) throw new Error("Chain not found");

    return id;
  }

  async getProvider() {
    return this.#provider;
  }

  getWalletClient = async () => {
    return createWalletClient({
      account: this.#currentAccount?.address as Address,
      chain: this.#currentChain?.chain,
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

    const skSupportedChain = [
      ...this.#filteredSkSupportedChainsValues!.values(),
    ]
      .map((v) => [...v.values()])
      .flat()
      .find((v) => v.chain.id === chainId);

    if (!skSupportedChain) throw new Error("Chain not found");

    if (currentChain.chain.id !== skSupportedChain.chain.id) {
      this.#currentChain = skSupportedChain;
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

type ChainItem = {
  currencyId: string;
  family: SupportedLedgerLiveFamilies;
  skChainName: SupportedSKChains;
  chain: Chain;
};
