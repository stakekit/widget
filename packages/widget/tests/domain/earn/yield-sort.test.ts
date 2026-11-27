import { describe, expect, it } from "vitest";

import { sortYields } from "../../../src/domain/earn/yield-sort";
import { yieldApiYieldFixture } from "../../fixtures";

const yieldOf = ({
  id,
  rate = 0.05,
  tvlUsd = null,
  ratings = [],
}: {
  readonly id: string;
  readonly rate?: number;
  readonly tvlUsd?: string | null;
  readonly ratings?: ReadonlyArray<{
    readonly rating: string;
    /** Left out as an API without Risk Scores leaves it out. */
    readonly score?: number | null;
    readonly source: "credora" | "stakingRewards";
  }>;
}) =>
  yieldApiYieldFixture({
    id,
    rewardRate: { rateType: "APY", total: rate },
    statistics: { tvlUsd },
    ...(ratings.length > 0 ? { risk: { ratings: [...ratings] as never } } : {}),
  });

const ids = (yields: ReadonlyArray<{ readonly id: string }>) =>
  yields.map((item) => item.id);

describe("sortYields", () => {
  it("lists the highest reward rate first, ties in their given order", () => {
    const yields = [
      yieldOf({ id: "mid-a", rate: 0.05 }),
      yieldOf({ id: "low", rate: 0.01 }),
      yieldOf({ id: "high", rate: 0.09 }),
      yieldOf({ id: "mid-b", rate: 0.05 }),
    ];

    expect(ids(sortYields(yields, "rewardRate"))).toEqual([
      "high",
      "mid-a",
      "mid-b",
      "low",
    ]);
  });

  it("lists a yield whose rate shows as missing after every shown rate", () => {
    const yields = [
      yieldOf({ id: "zero", rate: 0 }),
      yieldOf({ id: "negative", rate: -0.01 }),
      yieldOf({ id: "positive", rate: 0.02 }),
    ];

    expect(ids(sortYields(yields, "rewardRate"))).toEqual([
      "positive",
      "negative",
      "zero",
    ]);
  });

  it("lists the highest TVL first and yields that show none last", () => {
    const yields = [
      yieldOf({ id: "none" }),
      yieldOf({ id: "zero", tvlUsd: "0" }),
      yieldOf({ id: "small", tvlUsd: "950000.5" }),
      yieldOf({ id: "large", tvlUsd: "12000000" }),
    ];

    // A TVL of zero shows as none, so it keeps its place among them.
    expect(ids(sortYields(yields, "tvl"))).toEqual([
      "large",
      "small",
      "none",
      "zero",
    ]);
  });

  it("lists the lowest Risk Score first across raters, then the unrated and unscored", () => {
    const yields = [
      yieldOf({ id: "unrated" }),
      yieldOf({
        id: "sr-bb",
        ratings: [{ rating: "BB", score: 3, source: "stakingRewards" }],
      }),
      yieldOf({
        id: "credora-c",
        ratings: [{ rating: "C", score: 4, source: "credora" }],
      }),
      yieldOf({
        id: "unknown-grade",
        ratings: [{ rating: "Z", score: null, source: "credora" }],
      }),
      yieldOf({
        id: "sr-aa",
        ratings: [{ rating: "AA", score: 1, source: "stakingRewards" }],
      }),
      yieldOf({
        id: "unscored",
        ratings: [{ rating: "A", source: "credora" }],
      }),
      yieldOf({
        id: "credora-b",
        ratings: [{ rating: "B", score: 3, source: "credora" }],
      }),
      yieldOf({
        id: "credora-a-minus",
        ratings: [{ rating: "A-", score: 2, source: "credora" }],
      }),
    ];

    // Credora B and StakingRewards BB share a score, so they keep their order.
    expect(ids(sortYields(yields, "risk"))).toEqual([
      "sr-aa",
      "credora-a-minus",
      "sr-bb",
      "credora-b",
      "credora-c",
      "unrated",
      "unknown-grade",
      "unscored",
    ]);
  });

  it("orders by the Risk Score the API sends, whatever the grade", () => {
    const yields = [
      yieldOf({
        id: "credora-a",
        ratings: [{ rating: "A", score: 5, source: "credora" }],
      }),
      yieldOf({
        id: "sr-ccc",
        ratings: [{ rating: "CCC", score: 1, source: "stakingRewards" }],
      }),
    ];

    expect(ids(sortYields(yields, "risk"))).toEqual(["sr-ccc", "credora-a"]);
  });

  it("ranks a yield by the rating it shows, its first", () => {
    const yields = [
      yieldOf({
        id: "credora-first",
        ratings: [
          { rating: "C", score: 4, source: "credora" },
          { rating: "AAA", score: 1, source: "stakingRewards" },
        ],
      }),
      yieldOf({
        id: "credora-a",
        ratings: [{ rating: "A", score: 1, source: "credora" }],
      }),
    ];

    expect(ids(sortYields(yields, "risk"))).toEqual([
      "credora-a",
      "credora-first",
    ]);
  });
});
