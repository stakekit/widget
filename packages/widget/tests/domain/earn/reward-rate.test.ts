import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  type CampaignLifecycle,
  YieldCampaign,
} from "../../../src/domain/earn/campaign";
import {
  getEffectiveYieldRewardRateDetails,
  getRateComposition,
  type RatePart,
  withCampaignRate,
  type YieldRewardRate,
} from "../../../src/domain/earn/reward-rate";
import {
  EarnYield as EarnYieldSchema,
  type EarnYield,
} from "../../../src/domain/earn/yield-schema";
import { exactDecimal } from "../../../src/domain/finance/exact";
import {
  yieldApiCampaignDtoFixture,
  yieldApiValidatorFixture,
  yieldApiYieldDtoFixture,
  yieldApiYieldFixture,
  yieldRewardRateFixture,
} from "../../fixtures";
import { decodeValidator } from "../../utils/validators";

const token = yieldApiYieldFixture().token;

const component = (
  rate: number,
  yieldSource: YieldRewardRate["components"][number]["yieldSource"],
  rateType = "APY"
): YieldRewardRate["components"][number] => ({
  rate: exactDecimal(rate),
  rateType,
  token,
  yieldSource,
});

const nativeComponent = (rate: number) => component(rate, "staking");

// A 4.2% APR campaign, as the API lists it.
const campaign = (
  overrides?: Parameters<typeof yieldApiCampaignDtoFixture>[0]
) =>
  Schema.decodeUnknownSync(YieldCampaign)(
    yieldApiCampaignDtoFixture(overrides)
  );

const parts = (rewardRate: YieldRewardRate) => {
  const { native, protocolIncentive, campaign, total } = getRateComposition(
    rewardRate,
    null
  );
  const part = (value: RatePart | null) =>
    value ? [value.rate.toNumber(), value.rateType] : null;
  return {
    native: part(native),
    protocolIncentive: part(protocolIncentive),
    campaign: part(campaign),
    total: part(total),
  };
};

describe("getRateComposition with the yield's shown campaign", () => {
  // The yield's own 5.8% APY, with what else the API lists beside it.
  const rates = {
    // The campaign's part, already listed at 3%.
    listed: yieldRewardRateFixture({
      total: 0.088,
      components: [
        component(0.058, "vault"),
        component(0.03, "campaign_incentive", "APR"),
      ],
    }),
    // The yield's rate, cached before the campaign started paying.
    missing: yieldRewardRateFixture({
      total: 0.058,
      components: [component(0.058, "vault")],
    }),
    // As base-usdc-pusdc lists: its part a hair over its total.
    rounded: yieldRewardRateFixture({
      total: "0.04041282941447777",
      components: [
        {
          rate: exactDecimal("0.04041282942103987"),
          rateType: "APY",
          token,
          yieldSource: "vault",
        },
      ],
    }),
    // A 4.2% campaign part decoding dropped, still in its 10% total.
    dropped: yieldRewardRateFixture({
      total: 0.1,
      components: [component(0.058, "vault")],
    }),
  } as const;

  type Shown = Exclude<CampaignLifecycle, "ended"> | "none";
  const compose = (rate: keyof typeof rates, shown: Shown) => {
    const composition = getRateComposition(
      rates[rate],
      shown === "none" ? null : { campaign: campaign(), lifecycle: shown }
    );
    return {
      native: [composition.native.rate.toFixed(), composition.native.source],
      campaign: composition.campaign
        ? [
            composition.campaign.rate.toFixed(),
            composition.campaign.rateType,
            composition.campaign.source,
          ]
        : null,
      total: [composition.total.rate.toFixed(), composition.total.rateType],
      withCampaign: composition.withCampaign.toFixed(),
    };
  };

  it.each([
    // Earning: the listed part stays; a missing one is the campaign's own
    // rate, added to the total; a dropped one leaves the total as given.
    ...(["active", "ending_soon"] as const).flatMap((shown) => [
      {
        shown,
        rate: "listed",
        native: ["0.058", "listed"],
        campaign: ["0.03", "APR", "listed"],
        total: ["0.088", "APY"],
        withCampaign: "0.088",
      } as const,
      {
        shown,
        rate: "missing",
        native: ["0.058", "listed"],
        campaign: ["0.042", "APR", "campaign"],
        total: ["0.1", "APY"],
        withCampaign: "0.1",
      } as const,
      {
        shown,
        rate: "rounded",
        native: ["0.04041282942103987", "listed"],
        campaign: ["0.042", "APR", "campaign"],
        total: ["0.08241282941447777", "APY"],
        withCampaign: "0.08241282941447777",
      } as const,
      {
        shown,
        rate: "dropped",
        native: ["0.058", "listed"],
        campaign: null,
        total: ["0.1", "APY"],
        withCampaign: "0.1",
      } as const,
    ]),
    // Before the start: the planned rate, outside today's total.
    {
      shown: "upcoming",
      rate: "listed",
      native: ["0.058", "listed"],
      campaign: ["0.042", "APR", "planned"],
      total: ["0.088", "APY"],
      withCampaign: "0.13",
    },
    {
      shown: "upcoming",
      rate: "missing",
      native: ["0.058", "listed"],
      campaign: ["0.042", "APR", "planned"],
      total: ["0.058", "APY"],
      withCampaign: "0.1",
    },
    {
      shown: "upcoming",
      rate: "rounded",
      native: ["0.04041282942103987", "listed"],
      campaign: ["0.042", "APR", "planned"],
      total: ["0.04041282941447777", "APY"],
      withCampaign: "0.08241282941447777",
    },
    {
      shown: "upcoming",
      rate: "dropped",
      native: ["0.058", "listed"],
      campaign: ["0.042", "APR", "planned"],
      total: ["0.1", "APY"],
      withCampaign: "0.142",
    },
    // Paused: no campaign part, the total as given.
    {
      shown: "paused",
      rate: "listed",
      native: ["0.058", "listed"],
      campaign: null,
      total: ["0.088", "APY"],
      withCampaign: "0.088",
    },
    {
      shown: "paused",
      rate: "missing",
      native: ["0.058", "listed"],
      campaign: null,
      total: ["0.058", "APY"],
      withCampaign: "0.058",
    },
    {
      shown: "paused",
      rate: "dropped",
      native: ["0.058", "listed"],
      campaign: null,
      total: ["0.1", "APY"],
      withCampaign: "0.1",
    },
    // Ended, or none shown: the rate as listed.
    {
      shown: "none",
      rate: "listed",
      native: ["0.058", "listed"],
      campaign: ["0.03", "APR", "listed"],
      total: ["0.088", "APY"],
      withCampaign: "0.088",
    },
    {
      shown: "none",
      rate: "missing",
      native: ["0.058", "listed"],
      campaign: null,
      total: ["0.058", "APY"],
      withCampaign: "0.058",
    },
    {
      shown: "none",
      rate: "dropped",
      native: ["0.058", "listed"],
      campaign: null,
      total: ["0.1", "APY"],
      withCampaign: "0.1",
    },
  ] as const)(
    "$shown campaign, $rate campaign part",
    ({ shown, rate, ...expected }) => {
      expect(compose(rate, shown)).toEqual(expected);
    }
  );

  it("counts as the own rate what the incentives leave of a total listing none", () => {
    const campaignOnly = yieldRewardRateFixture({
      total: 0.042,
      components: [component(0.042, "campaign_incentive", "APR")],
    });

    expect(
      getRateComposition(campaignOnly, {
        campaign: campaign(),
        lifecycle: "active",
      }).native
    ).toEqual({ rate: exactDecimal(0), rateType: "APY", source: "remainder" });
  });
});

describe("withCampaignRate", () => {
  const yieldToken = yieldApiYieldDtoFixture().token;
  const vaultRate = {
    rate: 0.058,
    rateType: "APY",
    token: yieldToken,
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
        components: components.map((part) => ({ ...part, token: yieldToken })),
      },
    });
  const running = campaign({ yieldId: "campaign-vault" });
  const rates = (yieldDto: EarnYield) => ({
    total: yieldDto.rewardRate.total.toNumber(),
    components: yieldDto.rewardRate.components.map((part) => [
      part.yieldSource,
      part.rateType,
      part.rate.toNumber(),
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

  it("composes the added part as the campaign's, not the API's, wherever the yield goes", () => {
    const enriched = withCampaignRate(vaultYield([vaultRate]), running);
    const campaignPart = (shown: "active" | null) => {
      const { campaign: part, total } = getRateComposition(
        enriched.rewardRate,
        shown ? { campaign: running, lifecycle: shown } : null
      );
      return {
        campaign: part ? [part.rate.toFixed(), part.source] : null,
        total: total.rate.toFixed(),
      };
    };

    expect(campaignPart(null)).toEqual({
      campaign: ["0.042", "campaign"],
      total: "0.1",
    });
    expect(campaignPart("active")).toEqual({
      campaign: ["0.042", "campaign"],
      total: "0.1",
    });
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
          vaultRate,
          {
            rate: 0.042,
            rateType: "APR",
            token: { network: yieldToken.network },
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

describe("getRateComposition", () => {
  it("splits the yield's own rate, protocol incentives and the campaign part, each in its rate type", () => {
    expect(
      parts(
        yieldRewardRateFixture({
          total: 0.102,
          components: [
            component(0.058, "vault"),
            component(0.002, "protocol_incentive"),
            component(0.042, "campaign_incentive", "APR"),
          ],
        })
      )
    ).toEqual({
      native: [0.058, "APY"],
      protocolIncentive: [0.002, "APY"],
      campaign: [0.042, "APR"],
      total: [0.102, "APY"],
    });
  });

  it("keeps the listed own rate and the total as given, even when they don't add up", () => {
    expect(
      parts(
        yieldRewardRateFixture({
          total: 0.0455,
          components: [
            component(0.0427, "vault"),
            component(0.0028, "protocol_incentive", "APR"),
            component(0.002, "campaign_incentive", "APR"),
          ],
        })
      )
    ).toEqual({
      native: [0.0427, "APY"],
      protocolIncentive: [0.0028, "APR"],
      campaign: [0.002, "APR"],
      total: [0.0455, "APY"],
    });
  });

  it("counts as the own rate of a rate listing none what the incentives leave of the total", () => {
    expect(
      parts(
        yieldRewardRateFixture({
          total: 0.042,
          components: [component(0.042, "campaign_incentive", "APR")],
        })
      ).native
    ).toEqual([0, "APY"]);
    expect(
      parts(yieldRewardRateFixture({ total: 0.058, components: [] }))
    ).toEqual({
      native: [0.058, "APY"],
      protocolIncentive: null,
      campaign: null,
      total: [0.058, "APY"],
    });
  });
});

describe("getEffectiveYieldRewardRateDetails", () => {
  it("falls back to the yield reward rate when no validator is selected", () => {
    const rewardRate = yieldRewardRateFixture({
      total: 0.1539,
      components: [nativeComponent(0.1539)],
    });
    const yieldDto = yieldApiYieldFixture({ rewardRate });

    expect(
      getEffectiveYieldRewardRateDetails({
        selectedValidators: new Map(),
        yieldDto,
      })
    ).toBe(yieldDto.rewardRate);
  });

  it("uses the selected validator reward rate", () => {
    const yieldDto = yieldApiYieldFixture({
      rewardRate: yieldRewardRateFixture({ total: 0.1539 }),
    });
    const validator = decodeValidator(
      yieldApiValidatorFixture({
        address: "validator-1",
        rewardRate: yieldRewardRateFixture({
          total: 0.1582,
          components: [nativeComponent(0.1582)],
        }),
      })
    );

    const rewardRate = getEffectiveYieldRewardRateDetails({
      selectedValidators: new Map([[validator.key, validator]]),
      yieldDto,
    });

    expect(rewardRate?.total.isEqualTo("0.1582")).toBe(true);
    expect(rewardRate?.components[0]?.rate.isEqualTo("0.1582")).toBe(true);
  });

  it("averages selected validator reward rates", () => {
    const yieldDto = yieldApiYieldFixture({
      rewardRate: yieldRewardRateFixture({ total: 0.1539 }),
    });
    const firstValidator = decodeValidator(
      yieldApiValidatorFixture({
        address: "validator-1",
        rewardRate: yieldRewardRateFixture({
          total: 0.16,
          components: [nativeComponent(0.16)],
        }),
      })
    );
    const secondValidator = decodeValidator(
      yieldApiValidatorFixture({
        address: "validator-2",
        rewardRate: yieldRewardRateFixture({
          total: 0.18,
          components: [nativeComponent(0.18)],
        }),
      })
    );

    const rewardRate = getEffectiveYieldRewardRateDetails({
      selectedValidators: new Map([
        [firstValidator.key, firstValidator],
        [secondValidator.key, secondValidator],
      ]),
      yieldDto,
    });

    expect(rewardRate?.total.isEqualTo("0.17")).toBe(true);
    expect(rewardRate?.components[0]?.rate.isEqualTo("0.17")).toBe(true);
  });
});
