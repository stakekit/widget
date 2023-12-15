import { Connector } from "wagmi";
import { isLedgerDappBrowserProvider } from "../../utils";
import { Address, createWalletClient, custom } from "viem";
import { Chain, Wallet } from "@stakekit/rainbowkit";
import { EthereumProvider } from "eip1193-provider";
import {
  Account,
  Currency,
  Transport,
  WalletAPIClient,
  WindowMessageTransport,
} from "@ledgerhq/wallet-api-client";
import {
  SupportedLedgerLiveFamilies,
  SupportedSKChains,
} from "../../domain/types/chains";
import { EitherAsync, List, Maybe } from "purify-ts";
import {
  getFilteredSupportedLedgerFamiliesWithCurrency,
  getLedgerCurrencies,
} from "./utils";
import { GetEitherAsyncRight } from "../../types";
import { getInitialQueryParams } from "../../hooks/use-init-query-params";

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

  #filteredSkSupportedChainsToCurrencyIdMap: Map<
    Chain["id"],
    Currency["id"]
  > | null = null;

  #currentChain: ChainItem | null = null;

  disabledChains: Chain[] = [];

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
    ).unsafeCoerce();

    const accounts = (
      await EitherAsync(() => this.getWalletApiClient().account.list()).mapLeft(
        (e) => {
          console.log(e);
          return new Error("could not get accounts");
        }
      )
    ).unsafeCoerce();

    const filteredSupportedLedgerFamiliesWithCurrency = (
      await getFilteredSupportedLedgerFamiliesWithCurrency({
        ledgerCurrencies,
        accounts,
      })
    ).unsafeCoerce();

    this.#filteredSkSupportedChainsToCurrencyIdMap = new Map(
      [...filteredSupportedLedgerFamiliesWithCurrency.values()].flatMap((v) =>
        [...v.values()].map((v) => [v.chain.id, v.currencyId])
      )
    );

    this.#filteredSkSupportedChainsValues =
      filteredSupportedLedgerFamiliesWithCurrency;

    const { enabled, disabled } = [
      ...filteredSupportedLedgerFamiliesWithCurrency.values(),
    ].reduce(
      (acc, next) => {
        next.forEach((v) => {
          if (v.enabled) {
            acc.enabled.push(v.chain);
          } else {
            acc.disabled.push(v.chain);
          }
        });

        return acc;
      },
      { enabled: [] as Chain[], disabled: [] as Chain[] }
    );

    // Set chains to expose for switcher
    // @ts-expect-error
    this.chains = enabled;
    this.disabledChains = disabled;

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

    const initNetwork = (await getInitialQueryParams({ isLedgerLive: true }))
      .toMaybe()
      .chainNullable((v) => v.network);

    const accountWithChain = initNetwork
      .chain((val) =>
        List.find((v) => v.chainItem.skChainName === val, accountsWithChain)
      )
      .altLazy(() => List.head(accountsWithChain))
      .toEither(new Error("Account not found"))
      .unsafeCoerce();

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

  requestAndSwitchAccount = (chain: Chain) =>
    EitherAsync.liftEither(
      Maybe.fromNullable(
        this.#filteredSkSupportedChainsToCurrencyIdMap?.get(chain.id)
      ).toEither(new Error("Chain not found"))
    )
      .chain((currencyId) =>
        EitherAsync(() =>
          this.getWalletApiClient().account.request({
            currencyIds: [currencyId],
          })
        ).mapLeft((e) => {
          console.log(e);
          return new Error("could not request account");
        })
      )
      .chain((account) => {
        this.#ledgerAccounts.push(account);
        this.chains.push(chain);
        this.disabledChains = this.disabledChains.filter(
          (c) => c.id !== chain.id
        );
        return EitherAsync(() => this.switchChain(chain.id));
      })
      .mapLeft((e) => {
        console.log(e);
        return new Error("failed to switch to new chain");
      });

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
      .flatMap((v) => [...v.values()])
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
