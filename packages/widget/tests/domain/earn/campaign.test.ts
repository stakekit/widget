import { DateTime, Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  getCampaignCeilingPlan,
  getCampaignLifecycle,
  getCampaignRewardsEstimate,
  getCampaignTimeline,
  getDisplayedCampaign,
  pinCampaignYields,
  YieldCampaign,
} from "../../../src/domain/earn/campaign";
import { exactDecimal } from "../../../src/domain/finance/exact";
import { YieldId } from "../../../src/domain/identity/identifiers";
import {
  yieldApiCampaignDtoFixture,
  yieldApiYieldDtoFixture,
  yieldApiYieldFixture,
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

  it("never moves a yield into another group", () => {
    const yields = [lending("lend"), vault("plain"), vault("campaign")];

    expect(ids(pinCampaignYields(yields, campaignYields))).toEqual([
      "lend",
      "campaign",
      "plain",
    ]);
  });
});

describe("getCampaignTimeline", () => {
  const tenDays = campaign({
    startTime: "2026-12-01T00:00:00.000Z",
    endTime: "2026-12-11T00:00:00.000Z",
  });

  it("counts whole days to the start before it begins", () => {
    expect(
      getCampaignTimeline(tenDays, at("2026-11-29T12:00:00.000Z"))
    ).toEqual({
      elapsed: 0,
      daysLeft: 10,
      daysUntilStart: 2,
      day: 0,
      durationDays: 10,
    });
  });

  it("measures the elapsed share, rounds days left up and counts the day it is on", () => {
    expect(
      getCampaignTimeline(tenDays, at("2026-12-03T12:00:00.000Z"))
    ).toEqual({
      elapsed: 0.25,
      daysLeft: 8,
      daysUntilStart: 0,
      day: 3,
      durationDays: 10,
    });
  });

  it("stops at the end", () => {
    expect(
      getCampaignTimeline(tenDays, at("2026-12-20T00:00:00.000Z"))
    ).toEqual({
      elapsed: 1,
      daysLeft: 0,
      daysUntilStart: 0,
      day: 10,
      durationDays: 10,
    });
  });
});

describe("getCampaignCeilingPlan", () => {
  const milestone = (overrides: Readonly<Record<string, unknown>>) => ({
    order: 1,
    apyCeiling: null,
    twTvlThreshold: null,
    tvlYearsTarget: null,
    unlockAfter: null,
    status: "locked",
    unlockedAt: null,
    ...overrides,
  });
  const steps = [
    milestone({ order: 1, apyCeiling: 0.075, twTvlThreshold: "10000000" }),
    milestone({
      order: 2,
      apyCeiling: 0.06,
      unlockAfter: "2027-02-01T00:00:00.000Z",
    }),
  ];

  it("has no plan without a ceiling", () => {
    expect(
      getCampaignCeilingPlan(
        campaign({ apyCeiling: null, apyCeilingMode: "combined" })
      )
    ).toBeNull();
  });

  it("starts at the configured ceiling, with every step ahead", () => {
    const plan = getCampaignCeilingPlan(
      campaign({
        apyCeiling: 0.1,
        apyCeilingMode: "combined",
        milestones: steps,
      })
    );

    expect(plan?.mode).toBe("combined");
    expect(plan?.current.toString()).toBe("0.1");
    expect(plan?.steppedDown).toBeNull();
    expect(
      plan?.steps.map(({ ceiling, state, trigger }) => [
        ceiling.toString(),
        state,
        trigger?.deposits?.toString() ?? null,
        trigger?.date ? DateTime.formatIso(trigger.date) : null,
      ])
    ).toEqual([
      ["0.1", "current", null, null],
      ["0.075", "next", "10000000", null],
      ["0.06", "next", null, "2027-02-01T00:00:00.000Z"],
    ]);
  });

  it("marks the reached steps and keeps when the step was reached", () => {
    const plan = getCampaignCeilingPlan(
      campaign({
        apyCeiling: 0.075,
        apyCeilingMode: "combined",
        milestones: [
          {
            ...steps[0],
            status: "funded",
            unlockedAt: "2026-12-01T00:00:00.000Z",
          },
          steps[1],
        ],
      })
    );

    // The starting ceiling is overwritten once a step unlocks, so it drops out.
    expect(
      plan?.steps.map(({ ceiling, state }) => [ceiling.toString(), state])
    ).toEqual([
      ["0.075", "current"],
      ["0.06", "next"],
    ]);
    expect(plan?.steppedDown).toEqual({
      trigger: { deposits: exactDecimal("10000000"), date: null },
      reachedAt: DateTime.makeUnsafe("2026-12-01T00:00:00.000Z"),
      from: null,
    });
  });

  it("gives the ceiling a later step moved from", () => {
    const plan = getCampaignCeilingPlan(
      campaign({
        apyCeiling: 0.06,
        apyCeilingMode: "combined",
        milestones: [
          { ...steps[0], status: "funded" },
          { ...steps[1], status: "unlocked" },
        ],
      })
    );

    expect(plan?.steps.map(({ state }) => state)).toEqual(["past", "current"]);
    expect(plan?.steppedDown?.from?.toString()).toBe("0.075");
  });

  it("has no plan when the API names a ceiling mode the widget doesn't know", () => {
    expect(
      getCampaignCeilingPlan(
        campaign({ apyCeiling: 0.1, apyCeilingMode: "new" })
      )
    ).toBeNull();
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
