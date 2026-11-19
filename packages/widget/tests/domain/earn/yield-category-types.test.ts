import { describe, expect, it } from "vitest";

import {
  getApiYieldTypesForYieldCategory,
  getYieldCategory,
  getYieldTypesSortRank,
  yieldCategories,
} from "../../../src/domain/earn/yield";
import type { EarnYieldWithProvider } from "../../../src/domain/earn/yield-schema";

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

const makeYield = (type: string): EarnYieldWithProvider =>
  ({
    mechanics: {
      type,
    },
    token: {
      network: "ethereum",
      symbol: "USDC",
    },
  }) as EarnYieldWithProvider;

describe("getApiYieldTypesForYieldCategory", () => {
  it("partitions every API yield type into exactly one category", () => {
    const mapped = yieldCategories.flatMap((category) =>
      getApiYieldTypesForYieldCategory(category)
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

describe("getYieldCategory", () => {
  it("does not assign unknown runtime yield types to a dashboard category", () => {
    expect(getYieldCategory(makeYield("future_yield_type"))).toBeNull();
  });
});
