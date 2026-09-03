import BigNumber from "bignumber.js";
import type { CollateralToken } from "../../../../domain/borrow/catalog/collateral-token";
import {
  getBorrowMarketPairLabel,
  type Market,
} from "../../../../domain/borrow/catalog/market";
import type { BorrowToken } from "../../../../domain/borrow/catalog/token";
import type { BorrowNetwork } from "../../../../domain/borrow/network";
import type { Token } from "../../../../domain/token/token";

export type BorrowEntryToken = Token & { network: BorrowNetwork };

type BorrowMarketGroup = {
  readonly bestRate: BigNumber;
  readonly key: string;
  readonly loanToken: BorrowToken;
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

const getBorrowMarketGroupKey = (market: Market) =>
  `${market.network}:${market.loanToken.address ?? market.loanToken.symbol}`;

const getBorrowMarketGroups = (
  markets: readonly Market[]
): readonly BorrowMarketGroup[] => {
  const groups = new Map<string, BorrowMarketGroup>();

  for (const market of markets) {
    const key = getBorrowMarketGroupKey(market);
    const existing = groups.get(key);

    groups.set(key, {
      bestRate: BigNumber.min(
        existing?.bestRate ?? market.borrowRate,
        market.borrowRate
      ),
      key,
      loanToken: market.loanToken,
      marketItems: [...(existing?.marketItems ?? []), market],
      network: market.network,
    });
  }

  return [...groups.values()];
};

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

const borrowGroupMatchesSearch = ({
  group,
  search,
}: {
  readonly group: BorrowMarketGroup;
  readonly search: string;
}) =>
  !search ||
  searchableText([
    group.loanToken.address,
    group.loanToken.name,
    group.loanToken.symbol,
  ]).includes(search);

export const filterBorrowMarketGroups = ({
  integrations,
  markets,
  search,
}: {
  readonly integrations: readonly NamedIntegration[];
  readonly markets: readonly Market[];
  readonly search: string;
}): readonly BorrowMarketGroup[] => {
  const integrationsById = new Map(
    integrations.map((integration) => [integration.id, integration])
  );
  const normalizedSearch = normalizeSearch(search);

  return getBorrowMarketGroups(
    markets.filter((market) => market.isBorrowEnabled)
  ).flatMap((group): BorrowMarketGroup[] => {
    const groupMatches = borrowGroupMatchesSearch({
      group,
      search: normalizedSearch,
    });
    const marketItems = group.marketItems.filter((market) =>
      groupMatches
        ? true
        : marketMatchesSearch({
            integrationName:
              integrationsById.get(market.integrationId)?.name ?? null,
            market,
            search: normalizedSearch,
          })
    );

    return groupMatches || marketItems.length > 0
      ? [{ ...group, marketItems }]
      : [];
  });
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
