import type {
  Account,
  CryptoCurrency,
  Currency,
  ERC20TokenCurrency,
  WalletAPIClient,
} from "@ledgerhq/wallet-api-client";
import { Effect, Record } from "effect";
import type { WalletNetwork } from "../../../../../domain/wallet/network";
import type { Chain } from "../../../wallet-descriptors";
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

/** Ledger currency id to its crypto-currency family; token currencies map to their parent's family. */
export type LedgerCurrencyFamilies = Map<
  Currency["id"],
  CryptoCurrency["family"]
>;

type SupportedLedgerCurrency =
  SupportedLedgerFamiliesWithCurrency[SupportedLedgerLiveFamilies][string];

export type LedgerChainItem = SupportedLedgerCurrency & {
  chain: Chain;
  enabled: boolean;
};

export type EnabledChainsMap = {
  evm: Partial<EvmChainsMap>;
  cosmos: Partial<CosmosChainsMap>;
  misc: Partial<MiscChainsMap>;
  substrate: Partial<SubstrateChainsMap>;
};

const ledgerFamilies: SupportedLedgerFamiliesWithCurrency =
  supportedLedgerFamiliesWithCurrency;

export const isSupportedLedgerLiveFamily = (
  family: string
): family is SupportedLedgerLiveFamilies =>
  Object.hasOwn(ledgerFamilies, family);

export const getFilteredSupportedLedgerFamiliesWithCurrency = ({
  accounts,
  ledgerCurrencies,
  enabledChainsMap,
}: {
  accounts: Account[];
  ledgerCurrencies: LedgerCurrencyFamilies;
  enabledChainsMap: EnabledChainsMap;
}): Map<SupportedLedgerLiveFamilies, Map<string, LedgerChainItem>> => {
  const accountsFamilies = new Set<string>();
  const accountsCurrencies = new Set<string>();
  for (const account of accounts) {
    const ledgerCurrency = ledgerCurrencies.get(account.currency);

    if (ledgerCurrency) {
      accountsFamilies.add(ledgerCurrency);
      accountsCurrencies.add(account.currency);
    }
  }

  const chainByNetwork = new Map<WalletNetwork, Chain>(
    [
      ...Object.values(enabledChainsMap.evm),
      ...Object.values(enabledChainsMap.cosmos),
      ...Object.values(enabledChainsMap.misc),
      ...Object.values(enabledChainsMap.substrate),
    ].map((entry) => [entry.network, entry.wagmiChain])
  );

  const result = new Map<
    SupportedLedgerLiveFamilies,
    Map<string, LedgerChainItem>
  >();
  for (const [family, currencies] of Record.toEntries(ledgerFamilies)) {
    const items = new Map<string, LedgerChainItem>();
    for (const [key, item] of Record.toEntries(currencies)) {
      const chain = chainByNetwork.get(item.network);

      if (!chain) continue;

      if (
        accountsFamilies.has(item.family) &&
        (key === "*" || accountsCurrencies.has(item.currencyId))
      ) {
        items.set(key, { ...item, chain, enabled: true });
      } else if (ledgerChainPriority.has(item.network)) {
        items.set(key, { ...item, chain, enabled: false });
      }
    }
    result.set(family, items);
  }

  return result;
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
    Effect.map((currencies): LedgerCurrencyFamilies => {
      const cryptoCurrency: LedgerCurrencyFamilies = new Map();
      const tokenCurrency: ERC20TokenCurrency[] = [];
      for (const currency of currencies) {
        if (currency.type === "CryptoCurrency") {
          cryptoCurrency.set(currency.id, currency.family);
        } else {
          tokenCurrency.push(currency);
        }
      }

      for (const token of tokenCurrency) {
        const parentCryptoCurrencyFamily = cryptoCurrency.get(token.parent);

        if (parentCryptoCurrencyFamily) {
          cryptoCurrency.set(token.id, parentCryptoCurrencyFamily);
        }
      }

      return cryptoCurrency;
    })
  );
