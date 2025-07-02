import type { Account, Currency } from "@ledgerhq/wallet-api-client";
import {
  deserializeTransaction,
  WalletAPIClient,
  WindowMessageTransport,
} from "@ledgerhq/wallet-api-client";
import type {
  Chain,
  WalletDetailsParams,
  WalletList,
} from "@stakekit/rainbowkit";
import { EitherAsync, List, Maybe } from "purify-ts";
import { BehaviorSubject, map } from "rxjs";
import type { Address } from "viem";
import type { CreateConnectorFn } from "wagmi";
import { createConnector } from "wagmi";
import { images } from "../../assets/images";
import { skNormalizeChainId } from "../../domain";
import type { SupportedSKChains } from "../../domain/types/chains";
import {
  ledgerChainPriority,
  type SupportedLedgerLiveFamilies,
} from "../../domain/types/chains/ledger";
import type { InitParams } from "../../domain/types/init-params";
import { isLedgerDappBrowserProvider } from "../../utils";
import { configMeta, type ExtraProps } from "./ledger-live-connector-meta";
import {
  getFilteredSupportedLedgerFamiliesWithCurrency,
  getLedgerCurrencies,
} from "./utils";

const createLedgerLiveConnector = ({
  walletDetailsParams,
  enabledChainsMap,
  queryParams,
}: {
  enabledChainsMap: EnabledChainsMap;
  queryParams: InitParams;
  walletDetailsParams: WalletDetailsParams;
}) =>
  createConnector<unknown, ExtraProps>((config) => {
    const noAccountPlaceholder = "N/A" as Address;
    const $filteredChains = new BehaviorSubject<Chain[]>([]);
    const $disabledChains = new BehaviorSubject<Chain[]>([]);
    const $currentAccount = new BehaviorSubject<Account | undefined>(undefined);

    const $currentAccountId = $currentAccount.pipe(
      map((v) => v?.parentAccountId ?? v?.id)
    );
    let ledgerAccounts: Account[] = [];
    const $accountsOnCurrentChain = new BehaviorSubject<Account[]>([]);
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

      const allAccounts = (
        await EitherAsync(() => walletApiClient.account.list())
          .map((val) => ({
            accounts: val,
            accountsMap: new Map<Account["id"], Account>(
              val.map((v) => [v.id, v])
            ),
          }))
          .map((val) =>
            val.accounts.map((acc) =>
              acc.parentAccountId
                ? Maybe.fromNullable(val.accountsMap.get(acc.parentAccountId))
                    .map((parentAcc) => ({
                      ...acc,
                      currency: parentAcc.currency,
                    }))
                    .orDefault(acc)
                : acc
            )
          )
          .mapLeft((e) => {
            console.log(e);
            return new Error("could not get accounts");
          })
      ).unsafeCoerce();

      ledgerAccounts = allAccounts.filter((a) => !a.parentAccountId);

      const filteredSupportedLedgerFamiliesWithCurrency =
        getFilteredSupportedLedgerFamiliesWithCurrency({
          ledgerCurrencies,
          accounts: ledgerAccounts,
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

      const accountsWithChain = allAccounts
        .reduce(
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
        )
        .sort((a, b) => {
          const aPriority =
            ledgerChainPriority.get(a.chainItem.skChainName) || 999;
          const bPriority =
            ledgerChainPriority.get(b.chainItem.skChainName) || 999;

          return aPriority - bPriority;
        });

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

      const preferredAccount = Maybe.fromNullable(queryParams.accountId).chain(
        (accId) =>
          Maybe.encase(() => {
            if (accId.startsWith("js:")) {
              const [, , , address] = accId.split(":");

              return { type: "address", address } as const;
            }

            return { type: "accountId", accountId: accId } as const;
          })
      );

      const accountWithChain = preferredAccount
        .chain((pa) =>
          List.find((v) => {
            if (pa.type === "address") {
              return v.account.address === pa.address;
            }

            return v.account.id === pa.accountId;
          }, accountsWithChain)
        )
        .altLazy(() =>
          Maybe.fromNullable(queryParams.network).chain((network) =>
            List.find(
              (v) => v.chainItem.skChainName === network,
              accountsWithChain
            )
          )
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
      config.emitter.emit("change", { chainId: skNormalizeChainId(chainId) });
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

      if (!currChain || !filteredSkSupportedChainsValues)
        throw new Error("Chain not found");

      const skSupportedChain = [...filteredSkSupportedChainsValues.values()]
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
      $filteredChains: $filteredChains.asObservable(),
      $currentAccountId,
      $disabledChains: $disabledChains.asObservable(),
      noAccountPlaceholder,
      deserializeTransaction,
    };
  });

export const ledgerLiveConnector = ({
  enabledChainsMap,
  queryParams,
}: {
  enabledChainsMap: EnabledChainsMap;
  queryParams: InitParams;
}): WalletList[number] => ({
  groupName: "Ledger Live",
  wallets: [
    () => ({
      id: configMeta.id,
      name: configMeta.name,
      iconUrl: images.ledgerLogo,
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

export type EnabledChainsMap = Parameters<
  typeof getFilteredSupportedLedgerFamiliesWithCurrency
>[0]["enabledChainsMap"];
