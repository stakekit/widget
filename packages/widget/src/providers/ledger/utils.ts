import type {
  Account,
  CryptoCurrency,
  Currency,
  ERC20TokenCurrency,
  WalletAPIClient,
} from "@ledgerhq/wallet-api-client";
import type { CosmosChainsMap } from "@sk-widget/domain/types/chains/cosmos";
import type { EvmChainsMap } from "@sk-widget/domain/types/chains/evm";
import {
  ledgerChainPriority,
  type SupportedLedgerFamiliesWithCurrency,
  type SupportedLedgerLiveFamilies,
  supportedLedgerFamiliesWithCurrency,
} from "@sk-widget/domain/types/chains/ledger";
import type { MiscChainsMap } from "@sk-widget/domain/types/chains/misc";
import type { SubstrateChainsMap } from "@sk-widget/domain/types/chains/substrate";
import type { Chain } from "@stakekit/rainbowkit";
import { EitherAsync } from "purify-ts";
import type { SupportedSKChains } from "../../domain/types/chains";
import type { GetEitherAsyncRight } from "../../types";
import { typeSafeObjectEntries } from "../../utils";

export const getFilteredSupportedLedgerFamiliesWithCurrency = ({
  accounts,
  ledgerCurrencies,
  enabledChainsMap,
}: {
  accounts: Account[];
  ledgerCurrencies: GetEitherAsyncRight<ReturnType<typeof getLedgerCurrencies>>;
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

  const v = typeSafeObjectEntries(supportedLedgerFamiliesWithCurrency).reduce(
    (acc, [k, v]) => {
      const filtered = Object.keys(v).reduce((acc, key) => {
        const item = v[key as keyof typeof v] as {
          [K in keyof SupportedLedgerFamiliesWithCurrency]: SupportedLedgerFamiliesWithCurrency[K];
        }[keyof SupportedLedgerFamiliesWithCurrency];

        const chain =
          enabledChainsMap.evm[
            item.skChainName as unknown as EvmChainsMap[keyof EvmChainsMap]["skChainName"]
          ]?.wagmiChain ||
          enabledChainsMap.cosmos[
            item.skChainName as unknown as CosmosChainsMap[keyof CosmosChainsMap]["skChainName"]
          ]?.wagmiChain ||
          enabledChainsMap.misc[
            item.skChainName as unknown as MiscChainsMap[keyof MiscChainsMap]["skChainName"]
          ]?.wagmiChain ||
          enabledChainsMap.substrate[
            item.skChainName as unknown as SubstrateChainsMap[keyof SubstrateChainsMap]["skChainName"]
          ]?.wagmiChain;

        if (!chain) return acc;

        if (
          accountsFamilies.has(item.family) &&
          (key === "*" || accountsCurrencies.has(item.currencyId))
        ) {
          // biome-ignore lint: false
          return { ...acc, [key]: { ...item, chain, enabled: true } };
        }

        if (
          ledgerChainPriority.has(
            item.skChainName as unknown as SupportedSKChains
          )
        ) {
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
        acc.set(subKey as SubItemKey, subItem[subKey as keyof typeof subItem]);

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
          skChainName: SupportedSKChains;
          chain: Chain;
          enabled: boolean;
        }
      >
    >()
  );
};

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
  EitherAsync(() =>
    walletAPIClient.currency.list({
      currencyIds: Object.values(supportedLedgerFamiliesWithCurrency).flatMap(
        (chain) => Object.values(chain).map((currency) => currency.currencyId)
      ),
    })
  )
    .map((val) => {
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
    })
    .map((v) => {
      v.tokenCurrency.forEach((t) => {
        const parentCryptoCurrencyFamily = v.cryptoCurrency.get(t.parent);

        if (parentCryptoCurrencyFamily) {
          v.cryptoCurrency.set(t.id, parentCryptoCurrencyFamily);
        }
      });

      return v.cryptoCurrency;
    })
    .mapLeft((e) => {
      console.log(e);
      return new Error("could not get currencies");
    });
