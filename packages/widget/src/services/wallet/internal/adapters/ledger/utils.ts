import type {
  Account,
  CryptoCurrency,
  Currency,
  ERC20TokenCurrency,
  WalletAPIClient,
} from "@ledgerhq/wallet-api-client";
import type { Chain } from "@stakekit/rainbowkit";
import { Effect, Record } from "effect";
import type { WalletNetwork } from "../../../../../domain/wallet/network";
import { WalletIntegrationError } from "../../../wallet-errors";
import type { MiscChainsMap } from "../configured-chains";
import type { CosmosChainsMap } from "../cosmos/chains";
import type { EvmChainsMap } from "../evm/chains";
import type { SubstrateChainsMap } from "../substrate/chains";
import {
  ledgerChainPriority,
  type SupportedLedgerFamiliesWithCurrency,
  type SupportedLedgerLiveFamilies,
  supportedLedgerFamiliesWithCurrency,
} from "./chains";

export const getFilteredSupportedLedgerFamiliesWithCurrency = ({
  accounts,
  ledgerCurrencies,
  enabledChainsMap,
}: {
  accounts: Account[];
  ledgerCurrencies: Effect.Success<ReturnType<typeof getLedgerCurrencies>>;
  enabledChainsMap: {
    evm: Partial<EvmChainsMap>;
    cosmos: Partial<CosmosChainsMap>;
    misc: Partial<MiscChainsMap>;
    substrate: Partial<SubstrateChainsMap>;
  };
}) => {
  const { accountsFamilies, accountsCurrencies } = accounts.reduce(
    (acc, next) => {
      const ledgerCurrency = ledgerCurrencies.get(next.currency);

      if (ledgerCurrency) {
        acc.accountsFamilies.add(ledgerCurrency);
        acc.accountsCurrencies.add(next.currency);
      }

      return acc;
    },
    { accountsFamilies: new Set(), accountsCurrencies: new Set() }
  );

  const v = Record.toEntries(supportedLedgerFamiliesWithCurrency).reduce(
    (acc, [k, v]) => {
      const filtered = Object.keys(v).reduce((acc, key) => {
        const item = v[key as keyof typeof v] as
          | SupportedLedgerCurrency
          | undefined;

        if (!item) return acc;

        const chain =
          enabledChainsMap.evm[
            item.network as unknown as EvmChainsMap[keyof EvmChainsMap]["network"]
          ]?.wagmiChain ||
          enabledChainsMap.cosmos[
            item.network as unknown as CosmosChainsMap[keyof CosmosChainsMap]["network"]
          ]?.wagmiChain ||
          enabledChainsMap.misc[
            item.network as unknown as MiscChainsMap[keyof MiscChainsMap]["network"]
          ]?.wagmiChain ||
          enabledChainsMap.substrate[
            item.network as unknown as SubstrateChainsMap[keyof SubstrateChainsMap]["network"]
          ]?.wagmiChain;

        if (!chain) return acc;

        if (
          accountsFamilies.has(item.family) &&
          (key === "*" || accountsCurrencies.has(item.currencyId))
        ) {
          // biome-ignore lint: false
          return { ...acc, [key]: { ...item, chain, enabled: true } };
        }

        if (ledgerChainPriority.has(item.network)) {
          // biome-ignore lint: false
          return { ...acc, [key]: { ...item, chain, enabled: false } };
        }

        return acc;
      }, {} as MappedSupportedLedgerFamiliesWithCurrency);

      // biome-ignore lint: false
      return { ...acc, [k]: filtered };
    },
    {} as MappedSupportedLedgerFamiliesWithCurrency
  );

  type V = typeof v;
  type Key = keyof V;

  return Object.keys(v).reduce(
    (acc, key) => {
      const subItem = v[key as Key];

      type SubItemKey = keyof typeof subItem;

      const subItemMap = Object.keys(subItem).reduce((acc, subKey) => {
        const value = subItem[subKey as keyof typeof subItem];

        if (value) acc.set(subKey as SubItemKey, value);

        return acc;
      }, new Map<SubItemKey, V[Key][SubItemKey]>());

      acc.set(key as Key, subItemMap);

      return acc;
    },
    new Map<
      Key,
      Map<
        "*" | (string & {}),
        {
          currencyId: string;
          family: SupportedLedgerLiveFamilies;
          network: WalletNetwork;
          chain: Chain;
          enabled: boolean;
        }
      >
    >()
  );
};

type SupportedLedgerCurrency =
  SupportedLedgerFamiliesWithCurrency[keyof SupportedLedgerFamiliesWithCurrency][string];

type MappedSupportedLedgerFamiliesWithCurrency = {
  [Key in keyof SupportedLedgerFamiliesWithCurrency]: {
    [K in keyof SupportedLedgerFamiliesWithCurrency[Key]]: SupportedLedgerFamiliesWithCurrency[Key][K] & {
      chain: Chain;
      enabled: boolean;
    };
  };
};

/**
 * Create Map<CryptoCurrency['id'], CryptoCurrency['family']>
 * then use TokenCurrency parent to get CryptoCurrency family
 * and add to map TokenCurrency['id'] => CryptoCurrency['family']
 */
export const getLedgerCurrencies = (walletAPIClient: WalletAPIClient) =>
  Effect.tryPromise({
    try: () =>
      walletAPIClient.currency.list({
        currencyIds: Object.values(supportedLedgerFamiliesWithCurrency).flatMap(
          (chain) => Object.values(chain).map((currency) => currency.currencyId)
        ),
      }),
    catch: (cause) =>
      new WalletIntegrationError({
        cause,
        message: "could not get currencies",
        operation: "ledger-list-currencies",
      }),
  }).pipe(
    Effect.map((val) => {
      return val.reduce(
        (acc, next) => {
          if (next.type === "CryptoCurrency") {
            acc.cryptoCurrency.set(next.id, next.family);
          } else {
            acc.tokenCurrency.push(next);
          }

          return acc;
        },
        { cryptoCurrency: new Map(), tokenCurrency: [] } as {
          cryptoCurrency: Map<Currency["id"], CryptoCurrency["family"]>;
          tokenCurrency: ERC20TokenCurrency[];
        }
      );
    }),
    Effect.map((v) => {
      v.tokenCurrency.forEach((t) => {
        const parentCryptoCurrencyFamily = v.cryptoCurrency.get(t.parent);

        if (parentCryptoCurrencyFamily) {
          v.cryptoCurrency.set(t.id, parentCryptoCurrencyFamily);
        }
      });

      return v.cryptoCurrency;
    })
  );
