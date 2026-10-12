import BigNumber from "bignumber.js";
import type { CollateralToken } from "../../../../domain/borrow/catalog/collateral-token";
import {
  getBorrowMarketPairLabel,
  getMarketAvailableLiquidityUsd,
  isListedBorrowMarket,
  type Market,
} from "../../../../domain/borrow/catalog/market";
import type { BorrowToken } from "../../../../domain/borrow/catalog/token";
import type { BorrowNetwork } from "../../../../domain/borrow/network";
import { sumExact } from "../../../../domain/finance/exact";
import type { Token } from "../../../../domain/token/token";

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

type NamedIntegration = {
  readonly id: string;
  readonly name: string;
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
    ...market.collateralTokens.flatMap((collateralToken) => [
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
  readonly integrations: readonly NamedIntegration[];
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

export const filterBorrowCollateralTokens = ({
  collateralTokens,
  search,
}: {
  readonly collateralTokens: readonly CollateralToken[];
  readonly search: string;
}): readonly CollateralToken[] => {
  const normalizedSearch = normalizeSearch(search);

  return normalizedSearch
    ? collateralTokens.filter((collateralToken) =>
        searchableText([
          collateralToken.token.address,
          collateralToken.token.name,
          collateralToken.token.symbol,
        ]).includes(normalizedSearch)
      )
    : collateralTokens;
};
