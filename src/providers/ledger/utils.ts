import { Chain } from "@stakekit/rainbowkit";
import {
  CosmosChainsMap,
  EvmChainsMap,
  MiscChainsMap,
  SupportedLedgerFamiliesWithCurrency,
  SupportedLedgerLiveFamilies,
  SupportedSKChains,
  supportedLedgerFamiliesWithCurrency,
} from "../../domain/types/chains";
import { typeSafeObjectEntries } from "../../utils";
import { getWagmiConfig } from "../wagmi";
import {
  Account,
  CryptoCurrency,
  Currency,
  ERC20TokenCurrency,
  WalletAPIClient,
} from "@ledgerhq/wallet-api-client";
import { EitherAsync } from "purify-ts";
import { GetEitherAsyncRight } from "../../types";

export const getFilteredSupportedLedgerFamiliesWithCurrency = ({
  accounts,
  ledgerCurrencies,
}: {
  accounts: Account[];
  ledgerCurrencies: GetEitherAsyncRight<ReturnType<typeof getLedgerCurrencies>>;
}) =>
  getWagmiConfig({ forceWalletConnectOnly: false })
    .map((wagmiConfig) => {
      const { accountsFamilies, accountsCurrencies } = accounts.reduce(
        (acc, next) => {
          acc.accountsFamilies.add(ledgerCurrencies.get(next.currency));
          acc.accountsCurrencies.add(next.currency);

          return acc;
        },
        { accountsFamilies: new Set(), accountsCurrencies: new Set() }
      );

      return typeSafeObjectEntries(supportedLedgerFamiliesWithCurrency).reduce(
        (acc, [k, v]) => {
          const filtered = Object.keys(v).reduce(
            (acc, key) => {
              const item = v[key as keyof typeof v] as
                | SupportedLedgerFamiliesWithCurrency["ethereum"]["ethereum"]
                | SupportedLedgerFamiliesWithCurrency["ethereum"]["polygon"];

              const chain =
                wagmiConfig.evmConfig.evmChainsMap[
                  item.skChainName as EvmChainsMap[keyof EvmChainsMap]["skChainName"]
                ]?.wagmiChain ||
                wagmiConfig.cosmosConfig.cosmosChainsMap[
                  item.skChainName as unknown as CosmosChainsMap[keyof CosmosChainsMap]["skChainName"]
                ]?.wagmiChain ||
                wagmiConfig.miscConfig.miscChainsMap[
                  item.skChainName as unknown as MiscChainsMap[keyof MiscChainsMap]["skChainName"]
                ]?.wagmiChain;

              if (
                chain &&
                accountsFamilies.has(item.family) &&
                (key === "*" || accountsCurrencies.has(item.currencyId))
              ) {
                return { ...acc, [key]: { ...item, chain } };
              }

              return acc;
            },
            {} as typeof v & { chain: Chain }
          );

          return { ...acc, [k]: filtered };
        },
        {} as {
          [Key in keyof SupportedLedgerFamiliesWithCurrency]: {
            [K in keyof SupportedLedgerFamiliesWithCurrency[Key]]: SupportedLedgerFamiliesWithCurrency[Key][K] & {
              chain: Chain;
            };
          };
        }
      );
    })
    .map((v) => {
      type V = typeof v;
      type Key = keyof V;

      return Object.keys(v).reduce(
        (acc, key) => {
          const subItem = v[key as Key];

          type SubItemKey = keyof typeof subItem;

          const subItemMap = Object.keys(subItem).reduce((acc, subKey) => {
            acc.set(
              subKey as SubItemKey,
              subItem[subKey as keyof typeof subItem]
            );

            return acc;
          }, new Map<SubItemKey, V[SubItemKey]>());

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
            }
          >
        >()
      );
    });

/**
 * Create Map<CryptoCurrency['id'], CryptoCurrency['family']>
 * then use TokenCurrency parent to get CryptoCurrency family
 * and add to map TokenCurrency['id'] => CryptoCurrency['family']
 */
export const getLedgerCurrencies = (walletAPIClient: WalletAPIClient) =>
  EitherAsync(() => walletAPIClient.currency.list())
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
