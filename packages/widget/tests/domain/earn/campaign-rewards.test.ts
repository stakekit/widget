import { DateTime, Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  CampaignPayout,
  getCampaignPayoutAmount,
  getCampaignQualificationState,
  getCampaignRewardsAmounts,
  getCampaignRewardsStage,
  getYieldCampaignRewards,
  WalletCampaignRewards,
} from "../../../src/domain/earn/campaign-rewards";
import { exactDecimal } from "../../../src/domain/finance/exact";
import {
  yieldApiCampaignPayoutDtoFixture,
  yieldApiCampaignRewardsDtoFixture,
  yieldApiYieldFixture,
} from "../../fixtures";

const rewards = (overrides?: Readonly<Record<string, unknown>>) =>
  Schema.decodeUnknownSync(WalletCampaignRewards)(
    yieldApiCampaignRewardsDtoFixture(overrides)
  );
const payout = (overrides?: Readonly<Record<string, unknown>>) =>
  Schema.decodeUnknownSync(CampaignPayout)(
    yieldApiCampaignPayoutDtoFixture(overrides)
  );
const yieldToken = yieldApiYieldFixture().token;
const minimum = exactDecimal(10);
const qualification = (
  status: string,
  qualifyingBalance: string,
  incentivizedBalance: string
) => ({ qualification: { status, qualifyingBalance, incentivizedBalance } });

describe("getCampaignRewardsAmounts", () => {
  it("shows compound rewards in the yield's token, as the position holds them", () => {
    const amounts = getCampaignRewardsAmounts(rewards(), yieldToken);

    expect(amounts.token).toBe(yieldToken);
    expect(amounts.earned.toString()).toBe("80.39");
    expect(amounts.paid.toString()).toBe("77.87");
    expect(amounts.unpaid.toString()).toBe("2.52");
  });

  it("falls back to the reward token without a yield-token value", () => {
    const paidInWallet = rewards({
      rewardMode: "normal",
      inputTokenTotals: null,
    });
    const amounts = getCampaignRewardsAmounts(paidInWallet, yieldToken);

    expect(amounts.token.symbol).toBe("kAllezUSDC");
    expect(amounts.earned.toString()).toBe("77.1");
  });
});

describe("getCampaignQualificationState", () => {
  it("earns on the whole balance between the minimum and the cap", () => {
    expect(getCampaignQualificationState(rewards(), minimum)).toEqual({
      _tag: "Earning",
    });
  });

  it("names the part over the per-wallet cap", () => {
    const overCap = rewards(qualification("qualified", "82000", "50000"));

    expect(getCampaignQualificationState(overCap, minimum)).toEqual({
      _tag: "OverCap",
      cap: exactDecimal(50000),
      uncapped: exactDecimal(32000),
    });
  });

  it("says how much more to deposit below the minimum", () => {
    const below = rewards(qualification("below_threshold", "6.5", "0"));

    expect(getCampaignQualificationState(below, minimum)).toEqual({
      _tag: "BelowMinimum",
      minimum,
      shortfall: exactDecimal(3.5),
    });
  });

  it("leaves the shortfall unknown when the campaign's minimum is", () => {
    const below = rewards(qualification("below_threshold", "6.5", "0"));

    expect(getCampaignQualificationState(below, null)).toEqual({
      _tag: "BelowMinimum",
      minimum: null,
      shortfall: null,
    });
  });

  it("reports an excluded wallet without a reason", () => {
    const excluded = rewards(qualification("not_eligible", "25000", "0"));

    expect(getCampaignQualificationState(excluded, minimum)).toEqual({
      _tag: "NotEligible",
    });
  });

  it("is unknown while the backend can't count the balance yet", () => {
    expect(
      getCampaignQualificationState(rewards({ qualification: null }), minimum)
    ).toEqual({ _tag: "Unknown" });
  });
});

describe("getCampaignRewardsStage", () => {
  const now = DateTime.makeUnsafe("2026-12-01T00:00:00.000Z");
  const running = {
    endTime: DateTime.makeUnsafe("2027-04-10T00:00:00.000Z"),
    now,
  };

  it("earns while the campaign runs", () => {
    expect(getCampaignRewardsStage(rewards(), running)).toBe("earning");
  });

  it("is paused while the campaign is", () => {
    expect(
      getCampaignRewardsStage(rewards({ status: "paused" }), running)
    ).toBe("paused");
  });

  it("keeps a final payout pending after the end until it is paid", () => {
    expect(getCampaignRewardsStage(rewards({ status: "ended" }), running)).toBe(
      "final_payout_pending"
    );
    expect(
      getCampaignRewardsStage(
        rewards({
          status: "ended",
          totals: { earned: "77.1", paid: "77.1", unpaid: "0" },
          inputTokenTotals: { earned: "80.39", paid: "80.39", unpaid: "0" },
        }),
        { endTime: null, now }
      )
    ).toBe("paid_out");
  });

  it("ends at the campaign's end time while the API still lists it as running", () => {
    expect(
      getCampaignRewardsStage(rewards(), {
        endTime: DateTime.makeUnsafe("2026-11-30T00:00:00.000Z"),
        now,
      })
    ).toBe("final_payout_pending");
  });
});

describe("getCampaignPayoutAmount", () => {
  it("shows a compound payout in the yield's token when valued", () => {
    const amount = getCampaignPayoutAmount(payout(), rewards(), yieldToken);

    expect(amount.token).toBe(yieldToken);
    expect(amount.amount.toString()).toBe("3.04");
  });

  it("shows the reward token amount otherwise", () => {
    const amount = getCampaignPayoutAmount(
      payout({ inputTokenAmount: null }),
      rewards(),
      yieldToken
    );

    expect(amount.token.symbol).toBe("kAllezUSDC");
    expect(amount.amount.toString()).toBe("2.9197");
  });
});

describe("getYieldCampaignRewards", () => {
  const ofYield = (campaignId: string, status: string) =>
    rewards({ campaignId, status });
  const yieldId = yieldApiCampaignRewardsDtoFixture()["yieldId"] as never;

  it("shows a yield's live campaign before a paused or ended one", () => {
    const items = [
      ofYield("ended", "ended"),
      ofYield("paused", "paused"),
      ofYield("live", "active"),
    ];

    expect(getYieldCampaignRewards(items, yieldId)?.campaignId).toBe("live");
    expect(
      getYieldCampaignRewards(items.slice(0, 2), yieldId)?.campaignId
    ).toBe("paused");
  });

  it("has none for a yield the wallet earned nothing in", () => {
    expect(
      getYieldCampaignRewards([rewards()], "other-yield" as never)
    ).toBeNull();
  });
});
