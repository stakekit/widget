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
import { Effect, Result, Stream } from "effect";
import type { Address } from "viem";
import type { CreateConnectorFn } from "wagmi";
import { createConnector } from "wagmi";
import type { WalletNetwork } from "../../../../../domain/wallet/network";
import type { InitParams } from "../../../../../services/wallet/init-params";
import { makeCurrentValueStream } from "../../../../../shared/effect/current-value-stream";
import { WalletIntegrationError } from "../../../wallet-errors";
import { normalizeChainId } from "../../normalize-chain-id";
import { walletImages } from "../../runtime/assets";
import type { RunWalletEffect } from "../../runtime/effect-runner";
import { wagmiConnectResult } from "../wagmi-connect-result";
import {
  ledgerChainPriority,
  type SupportedLedgerLiveFamilies,
} from "./chains";
import { configMeta, type ExtraProps } from "./ledger-live-connector-meta";
import {
  makePrepareLedgerLiveTransaction,
  type PrepareLedgerLiveTransaction,
} from "./prepare-ledger-live-transaction";
import {
  getFilteredSupportedLedgerFamiliesWithCurrency,
  getLedgerCurrencies,
} from "./utils";

const createLedgerLiveConnector = ({
  walletDetailsParams,
  enabledChainsMap,
  isLedgerDappBrowser,
  prepareTransaction,
  queryParams,
  runWalletEffect,
}: {
  enabledChainsMap: EnabledChainsMap;
  isLedgerDappBrowser: boolean;
  prepareTransaction: PrepareLedgerLiveTransaction;
  queryParams: InitParams;
  runWalletEffect: RunWalletEffect;
  walletDetailsParams: WalletDetailsParams;
}) =>
  createConnector<unknown, ExtraProps>((config) => {
    const noAccountPlaceholder = "N/A" as Address;
    const filteredChains = makeCurrentValueStream<Chain[]>([]);
    const disabledChains = makeCurrentValueStream<Chain[]>([]);
    const currentAccount = makeCurrentValueStream<Account | undefined>(
      undefined
    );

    const currentAccountId = currentAccount.changes.pipe(
      Stream.map((value) => value?.parentAccountId ?? value?.id)
    );
    let ledgerAccounts: Account[] = [];
    const accountsOnCurrentChainState = makeCurrentValueStream<Account[]>([]);
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

    const connect: ReturnType<CreateConnectorFn>["connect"] = async (args) => {
      config.emitter.emit("message", { type: "connecting" });

      /**
       * Create Map<CryptoCurrency['id'], CryptoCurrency['family']>
       * then use TokenCurrency parent to get CryptoCurrency family
       * and add to map TokenCurrency['id'] => CryptoCurrency['family']
       */
      const ledgerCurrencies = await runWalletEffect(
        getLedgerCurrencies(walletApiClient)
      );

      const allAccounts = await runWalletEffect(
        Effect.tryPromise({
          try: () => walletApiClient.account.list(),
          catch: (cause) =>
            new WalletIntegrationError({
              cause,
              message: "could not get accounts",
              operation: "ledger-list-accounts",
            }),
        }).pipe(
          Effect.map((val) => ({
            accounts: val,
            accountsMap: new Map<Account["id"], Account>(
              val.map((v) => [v.id, v])
            ),
          })),
          Effect.map((val) =>
            val.accounts.map((acc) =>
              acc.parentAccountId
                ? (() => {
                    const parentAccount = val.accountsMap.get(
                      acc.parentAccountId
                    );

                    return parentAccount
                      ? { ...acc, currency: parentAccount.currency }
                      : acc;
                  })()
                : acc
            )
          )
        )
      );

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
      filteredChains.set([...enabled, ...disabled]);
      disabledChains.set(disabled);

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
          const aPriority = ledgerChainPriority.get(a.chainItem.network) || 999;
          const bPriority = ledgerChainPriority.get(b.chainItem.network) || 999;

          return aPriority - bPriority;
        });

      if (!accountsWithChain.length) {
        const defaultChain = filteredSupportedLedgerFamiliesWithCurrency
          .get("ethereum")
          ?.get("ethereum");

        if (!defaultChain) throw new Error("Default chain not found");

        accountsOnCurrentChainState.set([]);
        currentChain = defaultChain;

        onAccountsChanged([noAccountPlaceholder as Address]);
        onChainChanged(defaultChain.chain.id.toString());

        return wagmiConnectResult(
          args?.withCapabilities,
          [noAccountPlaceholder as Address],
          defaultChain.chain.id
        );
      }

      const getPreferredAccount = () => {
        if (!queryParams.accountId) return null;
        if (queryParams.accountId.startsWith("js:")) {
          return {
            type: "address",
            address: queryParams.accountId.split(":")[3],
          } as const;
        }
        return {
          type: "accountId",
          accountId: queryParams.accountId,
        } as const;
      };
      const preferredAccount = getPreferredAccount();
      const accountWithChain =
        (preferredAccount
          ? accountsWithChain.find((value) =>
              preferredAccount.type === "address"
                ? value.account.address === preferredAccount.address
                : value.account.id === preferredAccount.accountId
            )
          : undefined) ??
        (queryParams.network
          ? accountsWithChain.find(
              (value) => value.chainItem.network === queryParams.network
            )
          : undefined) ??
        accountsWithChain[0];

      if (!accountWithChain) throw new Error("Account not found");

      currentAccount.set(accountWithChain.account);
      currentChain = accountWithChain.chainItem;
      accountsOnCurrentChainState.set(
        Result.getOrThrow(getAccountsOnCurrentChain())
      );

      onAccountsChanged([accountWithChain.account.address as Address]);
      onChainChanged(currentChain.chain.id.toString());

      return wagmiConnectResult(
        args?.withCapabilities,
        [accountWithChain.account.address as Address],
        currentChain.chain.id
      );
    };

    const getAccountsOnCurrentChain = () =>
      currentChain
        ? Result.succeed(
            ledgerAccounts.filter(
              (account) => account.currency === currentChain?.currencyId
            )
          )
        : Result.fail(new Error("Current chain not found"));

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
      async () => isLedgerDappBrowser;

    const disconnect: ReturnType<CreateConnectorFn>["disconnect"] = async () =>
      transport.disconnect();

    const getChainId: ReturnType<CreateConnectorFn>["getChainId"] =
      async () => {
        const id = currentChain?.chain.id;

        if (!id) throw new Error("Chain not found");

        return id;
      };

    const getAccounts: ReturnType<CreateConnectorFn>["getAccounts"] =
      async () => [currentAccount.get()?.address as Address];

    const switchAccount = (account: Account) => {
      currentAccount.set(account);
      onAccountsChanged([account.address as Address]);
    };

    const requestAndSwitchAccount = (chain: Chain) =>
      Effect.gen(function* () {
        const currencyId = filteredSkSupportedChainsToCurrencyIdMap?.get(
          chain.id
        );

        if (!currencyId) {
          return yield* Effect.fail(
            new WalletIntegrationError({
              message: "Chain not found",
              operation: "ledger-request-account",
            })
          );
        }

        const account = yield* Effect.tryPromise({
          try: () =>
            walletApiClient.account.request({ currencyIds: [currencyId] }),
          catch: (cause) =>
            new WalletIntegrationError({
              cause,
              message: "could not request account",
              operation: "ledger-request-account",
            }),
        });

        ledgerAccounts.push(account);
        filteredChains.set([...filteredChains.get(), chain]);
        disabledChains.set(
          disabledChains.get().filter((c) => c.id !== chain.id)
        );
        return yield* Effect.tryPromise({
          try: () => switchChain({ chainId: chain.id }),
          catch: (cause) =>
            new WalletIntegrationError({
              cause,
              message: "failed to switch to new chain",
              operation: "ledger-switch-chain",
            }),
        });
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
        !currentAccount.get()
      ) {
        currentChain = skSupportedChain;
        const accountsOnCurrentChain = Result.getOrThrow(
          getAccountsOnCurrentChain()
        );

        accountsOnCurrentChainState.set(accountsOnCurrentChain);
        currentAccount.set(accountsOnCurrentChain[0]);
      }

      const selectedAccount = currentAccount.get();
      if (!selectedAccount) throw new Error("Account not found");

      onChainChanged(chainId.toString());
      onAccountsChanged([selectedAccount.address as Address]);

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
      $accountsOnCurrentChain: accountsOnCurrentChainState.changes,
      $filteredChains: filteredChains.changes,
      $currentAccountId: currentAccountId,
      $disabledChains: disabledChains.changes,
      noAccountPlaceholder,
      deserializeTransaction,
      prepareTransaction,
    };
  });

export const ledgerLiveConnector = ({
  enabledChainsMap,
  isLedgerDappBrowser,
  queryParams,
  runWalletEffect,
}: {
  enabledChainsMap: EnabledChainsMap;
  isLedgerDappBrowser: boolean;
  queryParams: InitParams;
  runWalletEffect: RunWalletEffect;
}): Effect.Effect<WalletList[number]> =>
  Effect.gen(function* () {
    const prepareTransaction = yield* makePrepareLedgerLiveTransaction;

    return {
      groupName: "Ledger Live",
      wallets: [
        () => ({
          id: configMeta.id,
          name: configMeta.name,
          iconUrl: walletImages.ledgerLogo,
          iconBackground: "#fff",
          chainGroup: {
            id: configMeta.id,
            title: configMeta.name,
            iconUrl: walletImages.ledgerLogo,
          },
          hidden: () => !isLedgerDappBrowser,
          createConnector: (walletDetailsParams) =>
            createLedgerLiveConnector({
              walletDetailsParams,
              enabledChainsMap,
              isLedgerDappBrowser,
              prepareTransaction,
              queryParams,
              runWalletEffect,
            }),
        }),
      ],
    };
  });

type ChainItem = {
  currencyId: string;
  family: SupportedLedgerLiveFamilies;
  network: WalletNetwork;
  chain: Chain;
};

export type EnabledChainsMap = Parameters<
  typeof getFilteredSupportedLedgerFamiliesWithCurrency
>[0]["enabledChainsMap"];
