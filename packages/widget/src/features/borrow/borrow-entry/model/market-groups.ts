import BigNumber from "bignumber.js";
import type { CollateralToken } from "../../../../domain/borrow/catalog/collateral-token";
import type { Integration } from "../../../../domain/borrow/catalog/integration";
import {
  getBorrowMarketPairLabel,
  getListedCollateralTokens,
  getMarketAvailableLiquidityUsd,
  isListedBorrowMarket,
  type Market,
} from "../../../../domain/borrow/catalog/market";
import type { BorrowToken } from "../../../../domain/borrow/catalog/token";
import { decodeTokenId } from "../../../../domain/borrow/ids";
import type { BorrowNetwork } from "../../../../domain/borrow/network";
import { exactZero, sumExact } from "../../../../domain/finance/exact";
import type { TokenBalance } from "../../../../domain/finance/models";
import type { Token } from "../../../../domain/token/token";
import { deriveBorrowMarketWalletBalances } from "../../action-preparation/index";

export type BorrowCollateralOption = {
  readonly collateralToken: CollateralToken;
  /** Null until wallet balances load. */
  readonly walletAmount: BigNumber | null;
  readonly walletUsd: BigNumber | null;
};

export type BorrowEntryToken = Token & { network: BorrowNetwork };

type BorrowMarketGroup = {
  readonly availableLiquidityUsd: BigNumber;
  readonly bestRate: BigNumber;
  readonly key: string;
  readonly loanToken: BorrowToken;
  /** Deepest market first. */
  readonly marketItems: readonly Market[];
  readonly network: BorrowNetwork;
};

export const toBorrowEntryToken = ({
  network,
  token,
}: {
  readonly network: BorrowNetwork;
  readonly token: BorrowToken;
}): BorrowEntryToken => ({
  decimals: token.decimals,
  name: token.name,
  network,
  symbol: token.symbol,
  ...(token.address ? { address: token.address } : {}),
  ...(token.logoURI ? { logoURI: token.logoURI } : {}),
});

const normalizeSearch = (value: string) => value.trim().toLowerCase();

const searchableText = (values: readonly (string | null | undefined)[]) =>
  values.filter(Boolean).join(" ").toLowerCase();

const marketMatchesSearch = ({
  integrationName,
  market,
  search,
}: {
  readonly integrationName: string | null;
  readonly market: Market;
  readonly search: string;
}) => {
  if (!search) {
    return true;
  }

  return searchableText([
    getBorrowMarketPairLabel(market),
    integrationName,
    market.integrationId,
    market.loanToken.address,
    market.loanToken.name,
    market.loanToken.symbol,
    ...getListedCollateralTokens(market).flatMap((collateralToken) => [
      collateralToken.token.address,
      collateralToken.token.name,
      collateralToken.token.symbol,
    ]),
  ]).includes(search);
};

const byAvailableLiquidityDesc =
  <T>(getLiquidityUsd: (item: T) => BigNumber) =>
  (left: T, right: T) =>
    getLiquidityUsd(right).comparedTo(getLiquidityUsd(left)) ?? 0;

/**
 * Groups listed markets that match the search by loan token. Groups and their
 * markets are ordered deepest first so thin markets never lead the list.
 */
export const filterBorrowMarketGroups = ({
  integrations,
  markets,
  search,
}: {
  readonly integrations: ReadonlyArray<Pick<Integration, "id" | "name">>;
  readonly markets: readonly Market[];
  readonly search: string;
}): readonly BorrowMarketGroup[] => {
  const integrationNames = new Map(
    integrations.map((integration) => [integration.id, integration.name])
  );
  const normalizedSearch = normalizeSearch(search);
  const marketsByGroupKey = new Map<string, [Market, ...Market[]]>();

  for (const market of markets) {
    if (
      !isListedBorrowMarket(market) ||
      !marketMatchesSearch({
        integrationName: integrationNames.get(market.integrationId) ?? null,
        market,
        search: normalizedSearch,
      })
    ) {
      continue;
    }

    const key = `${market.network}:${market.loanToken.address ?? market.loanToken.symbol}`;
    const existing = marketsByGroupKey.get(key);

    marketsByGroupKey.set(key, existing ? [...existing, market] : [market]);
  }

  return [...marketsByGroupKey]
    .map(
      ([key, groupMarkets]): BorrowMarketGroup => ({
        availableLiquidityUsd: sumExact(
          groupMarkets.map(getMarketAvailableLiquidityUsd)
        ),
        bestRate: BigNumber.min(
          ...groupMarkets.map((market) => market.borrowRate)
        ),
        key,
        loanToken: groupMarkets[0].loanToken,
        marketItems: [...groupMarkets].sort(
          byAvailableLiquidityDesc(getMarketAvailableLiquidityUsd)
        ),
        network: groupMarkets[0].network,
      })
    )
    .sort(byAvailableLiquidityDesc((group) => group.availableLiquidityUsd));
};

/**
 * Listed collateral for the market, held tokens first by wallet USD value,
 * then by max LTV. The first option is the default collateral.
 */
export const rankBorrowCollateralOptions = ({
  balances,
  market,
}: {
  readonly balances: ReadonlyArray<TokenBalance> | null;
  readonly market: Market;
}): readonly BorrowCollateralOption[] => {
  const walletAmounts = new Map(
    balances
      ? deriveBorrowMarketWalletBalances({
          balances,
          market,
        }).collateralTokens.map((balance) => [
          decodeTokenId(balance.collateralToken.token),
          balance.amountValue,
        ])
      : []
  );

  return getListedCollateralTokens(market)
    .map((collateralToken): BorrowCollateralOption => {
      const walletAmount = balances
        ? (walletAmounts.get(decodeTokenId(collateralToken.token)) ??
          exactZero())
        : null;

      return {
        collateralToken,
        walletAmount,
        walletUsd: walletAmount?.multipliedBy(collateralToken.priceUsd) ?? null,
      };
    })
    .sort(
      (left, right) =>
        (right.walletUsd ?? exactZero()).comparedTo(
          left.walletUsd ?? exactZero()
        ) ||
        (right.collateralToken.maxLtv.comparedTo(left.collateralToken.maxLtv) ??
          0)
    );
};

export const filterBorrowCollateralOptions = ({
  options,
  search,
}: {
  readonly options: readonly BorrowCollateralOption[];
  readonly search: string;
}): readonly BorrowCollateralOption[] => {
  const normalizedSearch = normalizeSearch(search);

  return normalizedSearch
    ? options.filter(({ collateralToken }) =>
        searchableText([
          collateralToken.token.address,
          collateralToken.token.name,
          collateralToken.token.symbol,
        ]).includes(normalizedSearch)
      )
    : options;
};
