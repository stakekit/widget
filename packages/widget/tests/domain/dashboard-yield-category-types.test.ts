import { describe, expect, it } from "vitest";
import {
  dashboardYieldCategories,
  getApiYieldTypesForDashboardCategory,
  getDashboardYieldCategory,
  getYieldTypeLabels,
  getYieldTypesSortRank,
  type YieldBase,
} from "../../src/domain/types/yields";

const allApiYieldTypes = [
  "staking",
  "restaking",
  "lending",
  "vault",
  "fixed_yield",
  "real_world_asset",
  "concentrated_liquidity_pool",
  "liquidity_pool",
  "liquid_staking",
] as const;

const makeYield = (type: string): YieldBase =>
  ({
    mechanics: {
      type,
    },
    token: {
      network: "ethereum",
      symbol: "USDC",
    },
  }) as YieldBase;

const t = ((key: string) => {
  const values: Record<string, string> = {
    "yield_types.liquid-staking.title": "Liquid Staking",
    "yield_types.liquid-staking.review": "Liquid Staking",
    "yield_types.liquid-staking.cta": "Stake",
  };

  return values[key] ?? key;
}) as Parameters<typeof getYieldTypeLabels>[1];

describe("getApiYieldTypesForDashboardCategory", () => {
  it("maps stake to staking + restaking + liquid staking", () => {
    expect(getApiYieldTypesForDashboardCategory("stake").sort()).toEqual(
      ["liquid_staking", "restaking", "staking"].sort()
    );
  });

  it("maps defi to the deposit yield types", () => {
    expect(getApiYieldTypesForDashboardCategory("defi").sort()).toEqual(
      [
        "lending",
        "vault",
        "fixed_yield",
        "concentrated_liquidity_pool",
        "liquidity_pool",
      ].sort()
    );
  });

  it("maps rwa to real_world_asset", () => {
    expect(getApiYieldTypesForDashboardCategory("rwa")).toEqual([
      "real_world_asset",
    ]);
  });

  it("partitions every API yield type into exactly one category", () => {
    const mapped = dashboardYieldCategories.flatMap((category) =>
      getApiYieldTypesForDashboardCategory(category)
    );

    expect(mapped.slice().sort()).toEqual([...allApiYieldTypes].sort());
    expect(new Set(mapped).size).toBe(mapped.length);
    expect(mapped.length).toBe(allApiYieldTypes.length);
  });
});

describe("getYieldTypesSortRank", () => {
  it("ranks RWA yields before other API yield types", () => {
    const rwaRank = getYieldTypesSortRank(makeYield("real_world_asset"));
    const otherRanks = allApiYieldTypes
      .filter((type) => type !== "real_world_asset")
      .map((type) => getYieldTypesSortRank(makeYield(type)));

    expect(rwaRank).toBeLessThan(Math.min(...otherRanks));
  });

  it("assigns unknown runtime yield types a valid last-place rank", () => {
    const unknownRank = getYieldTypesSortRank(makeYield("future_yield_type"));
    const knownRanks = allApiYieldTypes.map((type) =>
      getYieldTypesSortRank(makeYield(type))
    );

    expect(Number.isFinite(unknownRank)).toBe(true);
    expect(unknownRank).toBeGreaterThan(Math.max(...knownRanks));
  });
});

describe("getDashboardYieldCategory", () => {
  it("does not assign unknown runtime yield types to a dashboard category", () => {
    expect(
      getDashboardYieldCategory(makeYield("future_yield_type"))
    ).toBeNull();
  });
});

describe("getYieldTypeLabels", () => {
  it("uses liquid staking copy for liquid_staking", () => {
    expect(getYieldTypeLabels(makeYield("liquid_staking"), t)).toEqual({
      type: "liquid_staking",
      title: "Liquid Staking",
      review: "Liquid Staking",
      cta: "Stake",
    });
  });

  it("uses generic copy for unknown runtime yield types", () => {
    expect(getYieldTypeLabels(makeYield("future_yield_type"), t)).toEqual({
      type: "unknown",
      title: "Yield",
      review: "Earn",
      cta: "Earn",
    });
  });
});
