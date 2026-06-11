import { describe, expect, it } from "vitest";
import {
  dashboardYieldCategories,
  getApiYieldTypesForDashboardCategory,
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
] as const;

describe("getApiYieldTypesForDashboardCategory", () => {
  it("maps stake to staking + restaking", () => {
    expect(getApiYieldTypesForDashboardCategory("stake").sort()).toEqual(
      ["restaking", "staking"].sort()
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
  const makeYield = (type: YieldBase["mechanics"]["type"]): YieldBase =>
    ({
      mechanics: {
        type,
      },
      token: {
        network: "ethereum",
        symbol: "USDC",
      },
    }) as YieldBase;

  it("ranks RWA yields before other API yield types", () => {
    const rwaRank = getYieldTypesSortRank(makeYield("real_world_asset"));
    const otherRanks = allApiYieldTypes
      .filter((type) => type !== "real_world_asset")
      .map((type) => getYieldTypesSortRank(makeYield(type)));

    expect(rwaRank).toBeLessThan(Math.min(...otherRanks));
  });
});
