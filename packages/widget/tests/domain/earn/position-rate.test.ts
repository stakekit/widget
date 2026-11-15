import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { YieldCampaign } from "../../../src/domain/earn/campaign";
import {
  getPositionRate,
  type PositionRateSources,
} from "../../../src/domain/earn/position-rate";
import type { YieldRewardRate } from "../../../src/domain/earn/reward-rate";
import {
  yieldApiCampaignDtoFixture,
  yieldApiYieldFixture,
  yieldRewardRateFixture,
} from "../../fixtures";

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

/** A shown campaign with a per-wallet cap of 50,000. */
const cappedCampaign = Schema.decodeUnknownSync(YieldCampaign)(
  yieldApiCampaignDtoFixture()
);

const shown = (
  input: Partial<PositionRateSources> & {
    readonly canEarnCampaign?: () => boolean;
  }
) => {
  const rate = getPositionRate({
    balanceRewardRate: vaultRate(0.03),
    getShownCampaign: () => cappedCampaign,
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
  it("leads with the wallet's own rate, and splits it, under the shown campaign's per-wallet cap", () => {
    expect(shown({})).toEqual({
      headline: [0.088, "APY"],
      personalized: true,
      composition: { native: 0.058, campaign: 0.03, total: 0.088 },
    });
  });

  it("uses the yield's rate, campaign part included, without a per-wallet cap or a shown campaign", () => {
    const uncapped = Schema.decodeUnknownSync(YieldCampaign)(
      yieldApiCampaignDtoFixture({
        qualificationConfig: { type: "min_token_amount", threshold: "10" },
      })
    );
    const yieldRate = {
      headline: [0.1, "APY"],
      personalized: false,
      composition: { native: 0.058, campaign: 0.042, total: 0.1 },
    };

    expect(shown({ getShownCampaign: () => uncapped })).toEqual(yieldRate);
    expect(shown({ getShownCampaign: () => null })).toEqual(yieldRate);
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
          {
            rewardRate: yieldRewardRateFixture({
              total: 0.04,
              rateType: "APR",
            }),
          },
          {},
          {
            rewardRate: yieldRewardRateFixture({
              total: 0.06,
              rateType: "APY",
            }),
          },
        ],
      })
    ).toEqual({
      headline: [0.05, "APR"],
      personalized: false,
      composition: null,
    });
  });
});
