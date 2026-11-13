import { describe, expect, it } from "vitest";

import type { YieldRewardRate } from "../../../src/domain/earn/reward-rate";
import { exactDecimal } from "../../../src/domain/finance/exact";
import {
  getPositionRate,
  type PositionRateInput,
} from "../../../src/features/position-details/model/position-rate";
import { yieldApiYieldFixture, yieldRewardRateFixture } from "../../fixtures";

const token = yieldApiYieldFixture().token;

/** A vault rate of 5.8% APY, with a campaign part when given. */
const vaultRate = (campaign: number | null): YieldRewardRate =>
  yieldRewardRateFixture({
    total: 0.058 + (campaign ?? 0),
    components: [
      { rate: 0.058, rateType: "APY", token, yieldSource: "vault" },
      ...(campaign === null
        ? []
        : [
            {
              rate: campaign,
              rateType: "APR",
              token,
              yieldSource: "campaign_incentive" as const,
            },
          ]),
    ],
  });

const shown = (input: Partial<PositionRateInput>) => {
  const rate = getPositionRate({
    balanceRewardRate: vaultRate(0.03),
    balanceRateIsPersonal: () => true,
    canEarnCampaign: () => true,
    validators: null,
    yieldRewardRate: vaultRate(0.042),
    ...input,
  });
  return {
    headline: [rate.headline.rate.toNumber(), rate.headline.rateType],
    personalized: rate.personalized,
    composition: rate.composition
      ? {
          native: rate.composition.native.rate.toNumber(),
          campaign: rate.composition.campaign?.rate.toNumber() ?? null,
          total: rate.composition.total.rate.toNumber(),
        }
      : null,
  };
};

describe("getPositionRate", () => {
  it("leads with the wallet's own rate, and splits it, when its campaign part is personal", () => {
    expect(shown({})).toEqual({
      headline: [0.088, "APY"],
      personalized: true,
      composition: { native: 0.058, campaign: 0.03, total: 0.088 },
    });
  });

  it("uses the yield's rate, campaign part included, when no wallet earns a rate of its own", () => {
    expect(shown({ balanceRateIsPersonal: () => false })).toEqual({
      headline: [0.1, "APY"],
      personalized: false,
      composition: { native: 0.058, campaign: 0.042, total: 0.1 },
    });
  });

  it("leaves the campaign out of Details for a wallet that can't earn it", () => {
    expect(
      shown({
        balanceRewardRate: vaultRate(null),
        canEarnCampaign: () => false,
      })
    ).toEqual({
      headline: [0.1, "APY"],
      personalized: false,
      composition: null,
    });
  });

  it("leads with the mean of the validators' rates, in the first one's rate type, which Details doesn't split", () => {
    expect(
      shown({
        balanceRewardRate: null,
        validators: [
          { rewardRate: exactDecimal(0.04), rewardType: "apr" },
          { rewardRate: null },
          { rewardRate: exactDecimal(0.06), rewardType: "apy" },
        ],
      })
    ).toEqual({
      headline: [0.05, "apr"],
      personalized: false,
      composition: null,
    });
  });
});
