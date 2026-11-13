import { DateTime, Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  getCampaignLifecycle,
  getCampaignProgress,
  getCampaignRateComposition,
  getCampaignRewardsEstimate,
  getDisplayedCampaign,
  getEarningCampaign,
  pinCampaignYields,
  withCampaignRate,
  YieldCampaign,
} from "../../../src/domain/earn/campaign";
import {
  EarnYield as EarnYieldSchema,
  type EarnYield,
} from "../../../src/domain/earn/yield-schema";
import { exactDecimal } from "../../../src/domain/finance/exact";
import { YieldId } from "../../../src/domain/identity/identifiers";
import {
  yieldApiCampaignDtoFixture,
  yieldApiYieldDtoFixture,
  yieldApiYieldFixture,
  yieldRewardRateFixture,
} from "../../fixtures";

const campaign = (
  overrides?: Parameters<typeof yieldApiCampaignDtoFixture>[0]
) =>
  Schema.decodeUnknownSync(YieldCampaign)(
    yieldApiCampaignDtoFixture(overrides)
  );

const at = (iso: string) => DateTime.makeUnsafe(iso);

describe("getCampaignLifecycle", () => {
  const running = campaign({
    startTime: "2026-11-16T12:00:00.000Z",
    endTime: "2027-05-15T12:00:00.000Z",
  });

  it("is upcoming before the start time", () => {
    expect(getCampaignLifecycle(running, at("2026-11-16T11:59:59.000Z"))).toBe(
      "upcoming"
    );
  });

  it("is active from exactly the start time", () => {
    expect(getCampaignLifecycle(running, at("2026-11-16T12:00:00.000Z"))).toBe(
      "active"
    );
  });

  it("is still active with exactly 14 days left, then ending soon", () => {
    expect(getCampaignLifecycle(running, at("2027-05-01T12:00:00.000Z"))).toBe(
      "active"
    );
    expect(getCampaignLifecycle(running, at("2027-05-01T12:00:01.000Z"))).toBe(
      "ending_soon"
    );
  });

  it("is ended from exactly the end time, even while the API still says active", () => {
    expect(getCampaignLifecycle(running, at("2027-05-15T12:00:00.000Z"))).toBe(
      "ended"
    );
  });

  it("is paused whenever the API pauses it before the end, even before the start", () => {
    const paused = campaign({
      status: "paused",
      startTime: "2026-11-16T12:00:00.000Z",
      endTime: "2027-05-15T12:00:00.000Z",
    });

    expect(getCampaignLifecycle(paused, at("2026-11-10T00:00:00.000Z"))).toBe(
      "paused"
    );
    expect(getCampaignLifecycle(paused, at("2027-05-15T12:00:00.000Z"))).toBe(
      "ended"
    );
  });
});

describe("getDisplayedCampaign", () => {
  const now = at("2026-12-14T09:00:00.000Z");
  const live = (id: string, createdAt: string) =>
    campaign({
      id,
      createdAt,
      startTime: "2026-11-16T12:00:00.000Z",
      endTime: "2027-05-15T12:00:00.000Z",
    });

  it("shows the newest live campaign, the one the yield's rate includes", () => {
    const older = live("older", "2026-10-01T00:00:00.000Z");
    const newer = live("newer", "2026-11-01T00:00:00.000Z");

    expect(getDisplayedCampaign([older, newer], now)).toEqual({
      campaign: newer,
      lifecycle: "active",
    });
  });

  it("prefers a live campaign over a paused or upcoming one", () => {
    const paused = campaign({
      id: "paused",
      status: "paused",
      createdAt: "2026-12-01T00:00:00.000Z",
    });
    const upcoming = campaign({
      id: "upcoming",
      createdAt: "2026-12-01T00:00:00.000Z",
      startTime: "2027-01-01T00:00:00.000Z",
      endTime: "2027-06-01T00:00:00.000Z",
    });
    const running = live("running", "2026-10-01T00:00:00.000Z");

    expect(
      getDisplayedCampaign([paused, upcoming, running], now)?.campaign.id
    ).toBe("running");
    expect(getDisplayedCampaign([upcoming, paused], now)?.lifecycle).toBe(
      "paused"
    );
  });

  it("shows nothing once every campaign has ended", () => {
    const ended = campaign({
      startTime: "2026-01-01T00:00:00.000Z",
      endTime: "2026-06-01T00:00:00.000Z",
    });

    expect(getDisplayedCampaign([ended], now)).toBeNull();
  });
});

describe("getCampaignRewardsEstimate", () => {
  const now = at("2026-12-14T00:00:00.000Z");
  // 5.80% native plus a 4.20% campaign incentive, minimum 10, cap 50,000.
  const estimate = (amount: number, endTime = "2028-12-14T00:00:00.000Z") =>
    getCampaignRewardsEstimate({
      amount: exactDecimal(amount),
      campaign: campaign({ startTime: "2026-11-16T12:00:00.000Z", endTime }),
      campaignIncentiveRate: exactDecimal(0.042),
      now,
      rewardRate: exactDecimal(0.1),
    });

  it("earns the whole rate on an amount between the minimum and the cap", () => {
    expect(estimate(25_000)?.yearly.toString()).toBe("2500");
    expect(estimate(10)?.yearly.toString()).toBe("1");
  });

  it("earns only the native rate below the minimum", () => {
    expect(estimate(6.5)?.yearly.toString()).toBe("0.377");
  });

  it("earns the campaign rate only on the part under the cap", () => {
    // 82,000 × 5.80% + 50,000 × 4.20%
    expect(estimate(82_000)?.yearly.toString()).toBe("6856");
  });

  it("counts the campaign rate only for the days the campaign has left", () => {
    // 73 days is a fifth of a year, and longer than a month.
    const shortCampaign = estimate(10_000, "2027-02-25T00:00:00.000Z");

    // 10,000 × 5.80% + 10,000 × 4.20% × 0.2
    expect(shortCampaign?.yearly.toString()).toBe("664");
    expect(shortCampaign?.monthly.toFixed(2)).toBe("83.33");
  });

  it("leaves estimates to the plain rate while the campaign is not earning", () => {
    const upcoming = getCampaignRewardsEstimate({
      amount: exactDecimal(25_000),
      campaign: campaign({ startTime: "2027-01-01T00:00:00.000Z" }),
      campaignIncentiveRate: exactDecimal(0.042),
      now,
      rewardRate: exactDecimal(0.1),
    });

    expect(upcoming).toBeNull();
  });
});

describe("pinCampaignYields", () => {
  const vault = (id: string) =>
    yieldApiYieldFixture({
      id,
      mechanics: { ...yieldApiYieldDtoFixture().mechanics, type: "vault" },
    });
  const lending = (id: string) =>
    yieldApiYieldFixture({
      id,
      mechanics: { ...yieldApiYieldDtoFixture().mechanics, type: "lending" },
    });
  const ids = (items: ReadonlyArray<{ readonly id: string }>) =>
    items.map((item) => item.id);
  const campaignYields = new Set([YieldId.make("campaign")]);

  it("moves a campaign yield to the top of its group and keeps the rest in order", () => {
    const yields = [
      vault("first"),
      vault("second"),
      vault("campaign"),
      lending("lend"),
    ];

    expect(ids(pinCampaignYields(yields, campaignYields))).toEqual([
      "campaign",
      "first",
      "second",
      "lend",
    ]);
  });

  it("moves a group with a campaign yield above the others, keeping each group whole", () => {
    const yields = [
      lending("lend"),
      lending("other-lend"),
      vault("plain"),
      vault("campaign"),
    ];

    expect(ids(pinCampaignYields(yields, campaignYields))).toEqual([
      "campaign",
      "plain",
      "lend",
      "other-lend",
    ]);
  });

  it("keeps the given group order without a campaign yield", () => {
    const yields = [lending("lend"), vault("plain")];

    expect(ids(pinCampaignYields(yields, campaignYields))).toEqual([
      "lend",
      "plain",
    ]);
  });
});

describe("withCampaignRate", () => {
  const token = yieldApiYieldDtoFixture().token;
  const vaultRate = {
    rate: 0.058,
    rateType: "APY",
    token,
    yieldSource: "vault",
  } as const;
  const vaultYield = (
    components: ReadonlyArray<{
      readonly rate: number;
      readonly rateType: string;
      readonly yieldSource: "vault" | "campaign_incentive";
    }>
  ) =>
    yieldApiYieldFixture({
      id: "campaign-vault",
      rewardRate: {
        rateType: "APY",
        total: components.reduce((total, { rate }) => total + rate, 0),
        components: components.map((component) => ({ ...component, token })),
      },
    });
  const running = campaign({ yieldId: "campaign-vault" });
  const rates = (yieldDto: EarnYield) => ({
    total: yieldDto.rewardRate.total.toNumber(),
    components: yieldDto.rewardRate.components.map((component) => [
      component.yieldSource,
      component.rateType,
      component.rate.toNumber(),
    ]),
  });

  it("adds the campaign's rate the yield's rate doesn't list yet", () => {
    expect(rates(withCampaignRate(vaultYield([vaultRate]), running))).toEqual({
      total: 0.1,
      components: [
        ["vault", "APY", 0.058],
        ["campaign_incentive", "APR", 0.042],
      ],
    });
  });

  it("reads parts the API rounds a hair off its total as making it up", () => {
    // As base-usdc-pusdc lists: parts 0.04041282942103987, total
    // 0.04041282941447777.
    const rounded = yieldApiYieldFixture({
      id: "campaign-vault",
      rewardRate: {
        rateType: "APY",
        total: 0.04041282941447777,
        components: [{ ...vaultRate, rate: 0.04041282942103987, token }],
      },
    });

    expect(
      rates(withCampaignRate(rounded, running)).components.map(
        ([source]) => source
      )
    ).toEqual(["vault", "campaign_incentive"]);
  });

  it("keeps the campaign part the yield's rate already lists", () => {
    const listed = vaultYield([
      vaultRate,
      { rate: 0.03, rateType: "APR", yieldSource: "campaign_incentive" },
    ]);

    expect(withCampaignRate(listed, running)).toBe(listed);
  });

  it("adds nothing when the parts it lists don't make up its total", () => {
    // The campaign part's token is malformed, so decoding drops that part,
    // while the total it is part of stays 0.10.
    const raw: unknown = {
      ...yieldApiYieldDtoFixture({ id: "campaign-vault" }),
      rewardRate: {
        rateType: "APY",
        total: 0.1,
        components: [
          { ...vaultRate, token },
          {
            rate: 0.042,
            rateType: "APR",
            token: { network: token.network },
            yieldSource: "campaign_incentive",
          },
        ],
      },
    };
    const dropped = Schema.decodeUnknownSync(EarnYieldSchema)(raw);

    expect(rates(withCampaignRate(dropped, running))).toEqual({
      total: 0.1,
      components: [["vault", "APY", 0.058]],
    });
  });
});

describe("getEarningCampaign", () => {
  const running = campaign({
    startTime: "2026-11-01T00:00:00.000Z",
    endTime: "2027-05-01T00:00:00.000Z",
  });
  const now = at("2026-12-01T00:00:00.000Z");

  it("is the shown campaign while it earns", () => {
    expect(getEarningCampaign([running], now)).toBe(running);
  });

  it("is none for a paused campaign, or one yet to start", () => {
    expect(
      getEarningCampaign([{ ...running, status: "paused" }], now)
    ).toBeNull();
    expect(
      getEarningCampaign([running], at("2026-10-01T00:00:00.000Z"))
    ).toBeNull();
  });
});

describe("getCampaignProgress", () => {
  const tenDays = campaign({
    startTime: "2026-12-01T00:00:00.000Z",
    endTime: "2026-12-11T00:00:00.000Z",
  });

  it("measures the elapsed share, from none before the start to all at the end", () => {
    expect(getCampaignProgress(tenDays, at("2026-11-29T12:00:00.000Z"))).toBe(
      0
    );
    expect(getCampaignProgress(tenDays, at("2026-12-03T12:00:00.000Z"))).toBe(
      0.25
    );
    expect(getCampaignProgress(tenDays, at("2026-12-20T00:00:00.000Z"))).toBe(
      1
    );
  });
});

describe("getCampaignRateComposition", () => {
  const token = yieldApiYieldFixture().token;
  const vaultRate = (campaignRate: number | null) =>
    yieldRewardRateFixture({
      total: 0.058 + (campaignRate ?? 0),
      components: [
        { rate: 0.058, rateType: "APY", token, yieldSource: "vault" },
        ...(campaignRate === null
          ? []
          : [
              {
                rate: campaignRate,
                rateType: "APR",
                token,
                yieldSource: "campaign_incentive" as const,
              },
            ]),
      ],
    });
  const shown = (
    lifecycle: "active" | "upcoming" | "paused",
    rewardRate = vaultRate(0.042)
  ) => {
    const {
      native,
      campaign: part,
      total,
      withCampaign,
    } = getCampaignRateComposition(rewardRate, {
      campaign: campaign(),
      lifecycle,
    });
    return {
      native: native.rate.toNumber(),
      campaign: part?.rate.toNumber() ?? null,
      total: total.rate.toNumber(),
      withCampaign: withCampaign.toNumber(),
    };
  };

  it("takes the campaign part the rate lists while the campaign earns", () => {
    expect(shown("active")).toEqual({
      native: 0.058,
      campaign: 0.042,
      total: 0.1,
      withCampaign: 0.1,
    });
  });

  it("shows the planned rate before the start, outside today's total", () => {
    expect(shown("upcoming", vaultRate(null))).toEqual({
      native: 0.058,
      campaign: 0.042,
      total: 0.058,
      withCampaign: 0.1,
    });
  });

  it("has no campaign part while paused", () => {
    expect(shown("paused", vaultRate(null))).toEqual({
      native: 0.058,
      campaign: null,
      total: 0.058,
      withCampaign: 0.058,
    });
  });
});

describe("YieldCampaign sponsor and terms", () => {
  it("keeps a sponsor and an https terms link", () => {
    const funded = campaign({
      sponsor: { name: "Kamino", logoURI: "https://example.com/kamino.svg" },
      termsUrl: "https://example.com/terms",
    });

    expect(funded.sponsor?.name).toBe("Kamino");
    expect(funded.termsUrl).toBe("https://example.com/terms");
  });

  it("drops a terms link the widget can't safely open", () => {
    expect(campaign({ termsUrl: "javascript:alert(1)" }).termsUrl).toBeNull();
  });

  it("reads monthly payouts", () => {
    expect(campaign({ payoutFrequency: "monthly" }).payoutFrequency).toBe(
      "monthly"
    );
  });
});
