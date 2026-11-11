import { describe, expect, it } from "vitest";

import { getRewardRateRows } from "../../../src/features/yield-summary/model/reward-rate-rows";
import { yieldRewardRateFixture } from "../../fixtures";

const rows = (rewardRate: Parameters<typeof yieldRewardRateFixture>[0]) =>
  getRewardRateRows(yieldRewardRateFixture(rewardRate), false, {
    rateType: "APR",
  }).map(({ key, rate }) => [key, rate.toString()]);

describe("getRewardRateRows", () => {
  it("doesn't count a campaign-only rate as the yield's own", () => {
    expect(
      rows({
        total: 0.042,
        components: [
          {
            rate: 0.042,
            rateType: "APR",
            token: {
              symbol: "ETH",
              name: "Ethereum",
              decimals: 18,
              network: "ethereum",
            },
            yieldSource: "campaign_incentive",
          },
        ],
      })
    ).toEqual([
      ["native", "0"],
      ["campaign", "0.042"],
    ]);
  });

  it("keeps the whole rate as the yield's own before the campaign is part of it", () => {
    expect(rows({ total: 0.058, components: [] })).toEqual([
      ["native", "0.058"],
      ["campaign", "0.058"],
    ]);
  });
});
