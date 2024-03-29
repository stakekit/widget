import {
  Connector,
  CreateConnectorFn,
  createConnector,
  normalizeChainId,
} from "wagmi";
import { isLedgerDappBrowserProvider } from "../../utils";
import { Address } from "viem";
import { Chain, WalletDetailsParams, WalletList } from "@stakekit/rainbowkit";
import {
  Account,
  Currency,
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
import { QueryParamsResult } from "../../hooks/use-init-query-params";
import { ledger } from "../../assets/images/ledger";
import { ConnectorWithFilteredChains } from "../../domain/types/connectors";
import { Observable } from "../../utils/observable";

const configMeta = {
  id: "ledgerLive",
  name: "Ledger Live",
  type: "ledgerLive",
};

type ExtraProps = ConnectorWithFilteredChains & {
  $disabledChains: Observable<Chain[]>;
  $currentAccountId: Observable<string | undefined>;
  $accountsOnCurrentChain: Observable<Account[]>;
  walletApiClient: WalletAPIClient;
  requestAndSwitchAccount: (chain: Chain) => EitherAsync<Error, Chain>;
  switchAccount: (account: Account) => void;
  noAccountPlaceholder: Address;
};

type LedgerLiveConnector = Connector & ExtraProps;

export const isLedgerLiveConnector = (
  connector: Connector
): connector is LedgerLiveConnector => connector.id === configMeta.id;

const createLedgerLiveConnector = ({
  walletDetailsParams,
  enabledChainsMap,
  queryParams,
}: {
  enabledChainsMap: EnabledChainsMap;
  queryParams: QueryParamsResult;
  walletDetailsParams: WalletDetailsParams;
}) =>
  createConnector<unknown, ExtraProps>((config) => {
    const noAccountPlaceholder = "N/A" as Address;
    const $filteredChains = new Observable<Chain[]>([]);
    const $disabledChains = new Observable<Chain[]>([]);
    const $currentAccount = new Observable<Account | undefined>(undefined);
    const $currentAccountId = $currentAccount.map((v) => v?.id);
    let ledgerAccounts: Account[] = [];
    const $accountsOnCurrentChain = new Observable<Account[]>([]);
    let currentChain: ChainItem | null = null;
    let filteredSkSupportedChainsToCurrencyIdMap: Map<
      Chain["id"],
      Currency["id"]
    > | null = null;
    let filteredSkSupportedChainsValues: ReturnType<
      typeof getFilteredSupportedLedgerFamiliesWithCurrency
    > | null = null;

    const transport = new WindowMessageTransport();
    transport.connect();
    const walletApiClient = new WalletAPIClient(transport);

    const connect: ReturnType<CreateConnectorFn>["connect"] = async () => {
      config.emitter.emit("message", { type: "connecting" });

      /**
       * Create Map<CryptoCurrency['id'], CryptoCurrency['family']>
       * then use TokenCurrency parent to get CryptoCurrency family
       * and add to map TokenCurrency['id'] => CryptoCurrency['family']
       */
      const ledgerCurrencies = (
        await getLedgerCurrencies(walletApiClient)
      ).unsafeCoerce();

      const accounts = (
        await EitherAsync(() => walletApiClient.account.list()).mapLeft((e) => {
          console.log(e);
          return new Error("could not get accounts");
        })
      ).unsafeCoerce();

      const filteredSupportedLedgerFamiliesWithCurrency =
        getFilteredSupportedLedgerFamiliesWithCurrency({
          ledgerCurrencies,
          accounts,
          enabledChainsMap,
        });

      filteredSkSupportedChainsToCurrencyIdMap = new Map(
        [...filteredSupportedLedgerFamiliesWithCurrency.values()].flatMap((v) =>
          [...v.values()].map((v) => [v.chain.id, v.currencyId])
        )
      );

      filteredSkSupportedChainsValues =
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
      $filteredChains.next([...enabled, ...disabled]);
      $disabledChains.next(disabled);

      ledgerAccounts = accounts;

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

      if (!accountsWithChain.length) {
        const defaultChain = Maybe.fromNullable(
          filteredSupportedLedgerFamiliesWithCurrency
            .get("ethereum")
            ?.get("ethereum")
        ).extractNullable();

        if (!defaultChain) throw new Error("Default chain not found");

        $accountsOnCurrentChain.next([]);
        currentChain = defaultChain;

        onAccountsChanged([noAccountPlaceholder as Address]);
        onChainChanged(defaultChain.chain.id.toString());

        return {
          accounts: [noAccountPlaceholder as Address],
          chainId: defaultChain.chain.id,
        };
      }

      const preferredAccount = Maybe.fromNullable(queryParams.accountId)
        .chain((accId) =>
          Maybe.encase(() => {
            const [, , , address] = accId.split(":");

            return address;
          })
        )
        .extractNullable();

      const accountWithChain = List.find(
        (v) =>
          (!preferredAccount || v.account.address === preferredAccount) &&
          v.chainItem.skChainName === queryParams.network,
        accountsWithChain
      )
        .altLazy(() => List.head(accountsWithChain))
        .toEither(new Error("Account not found"))
        .unsafeCoerce();

      $currentAccount.next(accountWithChain.account);
      currentChain = accountWithChain.chainItem;
      $accountsOnCurrentChain.next(getAccountsOnCurrentChain().unsafeCoerce());

      onAccountsChanged([accountWithChain.account.address as Address]);
      onChainChanged(currentChain.chain.id.toString());

      return {
        accounts: [accountWithChain.account.address as Address],
        chainId: currentChain.chain.id,
      };
    };

    const getAccountsOnCurrentChain = () =>
      Maybe.fromNullable(currentChain)
        .toEither(new Error("Current chain not found"))
        .map((val) =>
          ledgerAccounts.filter((a) => a.currency === val.currencyId)
        );

    const onAccountsChanged: ReturnType<CreateConnectorFn>["onAccountsChanged"] =
      (accounts) => {
        if (accounts.length === 0) {
          config.emitter.emit("disconnect");
        } else {
          config.emitter.emit("change", { accounts: accounts as Address[] });
        }
      };

    const onChainChanged: ReturnType<CreateConnectorFn>["onChainChanged"] = (
      chainId
    ) => {
      config.emitter.emit("change", { chainId: normalizeChainId(chainId) });
    };

    const onDisconnect: ReturnType<CreateConnectorFn>["onDisconnect"] = () => {
      config.emitter.emit("disconnect");
    };

    const getProvider: ReturnType<CreateConnectorFn>["getProvider"] =
      async () => ({});

    const isAuthorized: ReturnType<CreateConnectorFn>["isAuthorized"] =
      async () => isLedgerDappBrowserProvider();

    const disconnect: ReturnType<CreateConnectorFn>["disconnect"] = async () =>
      transport.disconnect();

    const getChainId: ReturnType<CreateConnectorFn>["getChainId"] =
      async () => {
        const id = currentChain?.chain.id;

        if (!id) throw new Error("Chain not found");

        return id;
      };

    const getAccounts: ReturnType<CreateConnectorFn>["getAccounts"] =
      async () => [$currentAccount.value?.address as Address];

    const switchAccount = (account: Account) => {
      $currentAccount.next(account);
      onAccountsChanged([account.address as Address]);
    };

    const requestAndSwitchAccount = (chain: Chain) =>
      EitherAsync.liftEither(
        Maybe.fromNullable(
          filteredSkSupportedChainsToCurrencyIdMap?.get(chain.id)
        ).toEither(new Error("Chain not found"))
      )
        .chain((currencyId) =>
          EitherAsync(() =>
            walletApiClient.account.request({ currencyIds: [currencyId] })
          ).mapLeft((e) => {
            console.log(e);
            return new Error("could not request account");
          })
        )
        .chain((account) => {
          ledgerAccounts.push(account);
          $filteredChains.next([...$filteredChains.value, chain]);
          $disabledChains.next(
            $disabledChains.value.filter((c) => c.id !== chain.id)
          );
          return EitherAsync(() => switchChain({ chainId: chain.id }));
        })
        .mapLeft((e) => {
          console.log(e);
          return new Error("failed to switch to new chain");
        });

    const switchChain: NonNullable<
      ReturnType<CreateConnectorFn>["switchChain"]
    > = async ({ chainId }): Promise<Chain> => {
      const currChain = currentChain;

      if (!currChain) throw new Error("Chain not found");

      const skSupportedChain = [...filteredSkSupportedChainsValues!.values()]
        .flatMap((v) => [...v.values()])
        .find((v) => v.chain.id === chainId);

      if (!skSupportedChain) throw new Error("Chain not found");

      if (
        currChain.chain.id !== skSupportedChain.chain.id ||
        !$currentAccount.value
      ) {
        currentChain = skSupportedChain;
        const accountsOnCurrentChain =
          getAccountsOnCurrentChain().unsafeCoerce();

        $accountsOnCurrentChain.next(accountsOnCurrentChain);
        $currentAccount.next(accountsOnCurrentChain[0]);
      }

      const currentAccount = $currentAccount.value;
      if (!currentAccount) throw new Error("Account not found");

      onChainChanged(chainId.toString());
      onAccountsChanged([currentAccount.address as Address]);

      return skSupportedChain.chain;
    };

    return {
      ...walletDetailsParams,
      id: configMeta.id,
      name: configMeta.name,
      type: configMeta.type,
      connect,
      onAccountsChanged,
      onChainChanged,
      onDisconnect,
      getProvider,
      isAuthorized,
      getChainId,
      disconnect,
      switchChain,
      getAccounts,
      switchAccount,
      requestAndSwitchAccount,
      walletApiClient,
      $accountsOnCurrentChain,
      $filteredChains,
      $currentAccountId,
      $disabledChains,
      noAccountPlaceholder,
    };
  });

export const ledgerLiveConnector = ({
  enabledChainsMap,
  queryParams,
}: {
  enabledChainsMap: EnabledChainsMap;
  queryParams: QueryParamsResult;
}): WalletList[number] => ({
  groupName: "Ledger Live",
  wallets: [
    () => ({
      id: configMeta.id,
      name: configMeta.name,
      iconUrl: ledger,
      iconBackground: "#fff",
      hidden: () => !isLedgerDappBrowserProvider(),
      createConnector: (walletDetailsParams) =>
        createLedgerLiveConnector({
          walletDetailsParams,
          enabledChainsMap,
          queryParams,
        }),
    }),
  ],
});

type ChainItem = {
  currencyId: string;
  family: SupportedLedgerLiveFamilies;
  skChainName: SupportedSKChains;
  chain: Chain;
};

type EnabledChainsMap = Parameters<
  typeof getFilteredSupportedLedgerFamiliesWithCurrency
>[0]["enabledChainsMap"];
