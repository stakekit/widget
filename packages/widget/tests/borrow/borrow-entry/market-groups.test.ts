import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";
import { Market } from "../../../src/domain/borrow/catalog/market";
import {
  filterBorrowCollateralTokens,
  filterBorrowMarketGroups,
  toBorrowEntryToken,
} from "../../../src/features/borrow/borrow-entry/model/market-groups";

const usdc = {
  address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  symbol: "USDC",
  name: "USD Coin",
  decimals: 6,
} as const;

const usdt = {
  address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  symbol: "USDT",
  name: "Tether USD",
  decimals: 6,
} as const;

const collateralToken = (token: {
  readonly address: string;
  readonly decimals: number;
  readonly name: string;
  readonly symbol: string;
}) => ({
  token,
  priceUsd: "2000",
  maxLtv: "0.8",
  liquidationThreshold: "0.85",
  liquidationPenalty: "0.05",
  supplyRate: "0.02",
});

const weth = {
  address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  symbol: "WETH",
  name: "Wrapped Ether",
  decimals: 18,
} as const;

const wbtc = {
  address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  symbol: "WBTC",
  name: "Wrapped BTC",
  decimals: 8,
} as const;

const makeMarket = ({
  borrowRate,
  collateralTokens,
  id,
  integrationId,
  isBorrowEnabled = true,
  loanToken,
}: {
  readonly borrowRate: string;
  readonly collateralTokens: ReadonlyArray<ReturnType<typeof collateralToken>>;
  readonly id: string;
  readonly integrationId: string;
  readonly isBorrowEnabled?: boolean;
  readonly loanToken: typeof usdc | typeof usdt;
}) =>
  Schema.decodeUnknownSync(Market)({
    id,
    integrationId,
    network: "ethereum",
    type: "pool",
    poolAddress: "0x0000000000000000000000000000000000000001",
    loanToken,
    collateralTokens,
    borrowRate,
    totalSupply: "1000000",
    totalSupplyRaw: "1000000000000",
    totalBorrow: "500000",
    totalBorrowRaw: "500000000000",
    availableLiquidity: "500000",
    availableLiquidityRaw: "500000000000",
    utilizationRate: "0.5",
    loanTokenPriceUsd: "1",
    isBorrowEnabled,
    supplyCollateralFeeBps: "0",
    feeWrapperAddress: null,
    originationFeeBps: "0",
    originationFeeWrapperAddress: null,
    minLoan: null,
  });

const aaveUsdc = makeMarket({
  borrowRate: "0.06",
  collateralTokens: [collateralToken(weth)],
  id: "aave-v3-ethereum-usdc",
  integrationId: "aave-borrow",
  loanToken: usdc,
});

const morphoUsdc = makeMarket({
  borrowRate: "0.04",
  collateralTokens: [collateralToken(wbtc)],
  id: "morpho-blue-ethereum-usdc",
  integrationId: "morpho-blue-borrow",
  loanToken: usdc,
});

const aaveUsdt = makeMarket({
  borrowRate: "0.07",
  collateralTokens: [collateralToken(weth)],
  id: "aave-v3-ethereum-usdt",
  integrationId: "aave-borrow",
  loanToken: usdt,
});

const integrations = [
  { id: "aave-borrow", name: "Aave V3" },
  { id: "morpho-blue-borrow", name: "Morpho Blue" },
];

const markets = [aaveUsdc, morphoUsdc, aaveUsdt];

describe("borrow market groups", () => {
  it("groups markets by loan token and keeps the best borrow rate", () => {
    const groups = filterBorrowMarketGroups({
      integrations,
      markets,
      search: "",
    });

    expect(
      groups.map((group) => ({
        bestRate: group.bestRate.toString(),
        markets: group.marketItems.length,
        symbol: group.loanToken.symbol,
      }))
    ).toEqual([
      { bestRate: "0.04", markets: 2, symbol: "USDC" },
      { bestRate: "0.07", markets: 1, symbol: "USDT" },
    ]);
  });

  it("keeps every market of a group whose loan token matches the search", () => {
    const groups = filterBorrowMarketGroups({
      integrations,
      markets,
      search: "  UsDc ",
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]?.marketItems.map((market) => market.id)).toEqual([
      aaveUsdc.id,
      morphoUsdc.id,
    ]);
  });

  it("narrows a group to the markets matching a provider search", () => {
    const groups = filterBorrowMarketGroups({
      integrations,
      markets,
      search: "morpho",
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]?.marketItems.map((market) => market.id)).toEqual([
      morphoUsdc.id,
    ]);
  });

  it("matches markets by collateral token symbol", () => {
    const groups = filterBorrowMarketGroups({
      integrations,
      markets,
      search: "wbtc",
    });

    expect(
      groups.flatMap((group) => group.marketItems.map((m) => m.id))
    ).toEqual([morphoUsdc.id]);
  });

  it("drops groups with no matching market", () => {
    expect(
      filterBorrowMarketGroups({ integrations, markets, search: "solana" })
    ).toEqual([]);
  });

  it("excludes markets where new borrowing is disabled", () => {
    const disabledMarket = makeMarket({
      borrowRate: "0.01",
      collateralTokens: [collateralToken(wbtc)],
      id: "disabled-usdc",
      integrationId: "aave-borrow",
      isBorrowEnabled: false,
      loanToken: usdc,
    });

    const groups = filterBorrowMarketGroups({
      integrations,
      markets: [disabledMarket, aaveUsdt],
      search: "",
    });

    expect(
      groups.flatMap((group) => group.marketItems.map((market) => market.id))
    ).toEqual([aaveUsdt.id]);
  });
});

describe("borrow collateral token filter", () => {
  it("returns every token for an empty search", () => {
    expect(
      filterBorrowCollateralTokens({
        collateralTokens: aaveUsdc.collateralTokens,
        search: "   ",
      })
    ).toEqual(aaveUsdc.collateralTokens);
  });

  it("filters by symbol, name, and address", () => {
    for (const search of ["weth", "Wrapped Ether", weth.address]) {
      expect(
        filterBorrowCollateralTokens({
          collateralTokens: aaveUsdc.collateralTokens,
          search,
        })
      ).toHaveLength(1);
    }

    expect(
      filterBorrowCollateralTokens({
        collateralTokens: aaveUsdc.collateralTokens,
        search: "wbtc",
      })
    ).toEqual([]);
  });
});

describe("dashboard borrow token projection", () => {
  it("carries the network and omits absent optional fields", () => {
    expect(
      toBorrowEntryToken({ network: "ethereum", token: aaveUsdc.loanToken })
    ).toEqual({
      address: usdc.address.toLowerCase(),
      decimals: 6,
      name: "USD Coin",
      network: "ethereum",
      symbol: "USDC",
    });
  });
});
