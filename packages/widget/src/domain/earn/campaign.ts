import type BigNumber from "bignumber.js";
import { DateTime, Duration, Schema, SchemaGetter, Struct } from "effect";

import * as YieldApi from "../../generated/api/yield-schema";
import { TolerantArray, TolerantNullOr } from "../decoding/response-schema";
import { exactDecimal, exactZero } from "../finance/exact";
import {
  ExactDecimal,
  NonNegativeExactDecimal,
  TolerantNullableUtcDateTimeFromString,
  UtcDateTimeFromString,
} from "../finance/scalars";
import { CampaignId, YieldId } from "../identity/identifiers";
import { Token } from "../token/token";
import {
  getRateComposition,
  type RateComposition,
  type YieldRewardRate,
} from "./reward-rate";
import { getExtendedYieldType } from "./yield";
import type { EarnYield } from "./yield-schema";

const operation = "campaigns";

const CampaignRate = Schema.Struct({
  ...Struct.pick(YieldApi.RewardRateDto.fields, ["rateType"]),
  total: ExactDecimal,
});

// Only the minimum-balance rule is understood. Any other rule type hides the
// rules rather than describing a different rule as a minimum balance.
const CampaignQualification = Schema.Struct({
  type: Schema.Literal("min_token_amount"),
  threshold: NonNegativeExactDecimal,
  maxIncentivizedTvlToken: Schema.optionalKey(
    Schema.NullOr(NonNegativeExactDecimal)
  ),
});

const HttpsUrl = Schema.String.check(Schema.isPattern(/^https:\/\/\S+$/));

const CampaignSponsor = Schema.Struct({
  name: Schema.NonEmptyString,
  // A logo the widget can't safely load is left out, not the sponsor.
  logoURI: TolerantNullOr(HttpsUrl, { operation, field: "sponsor.logoURI" }),
});

/**
 * A project-scoped, sponsor-funded incentive on one yield. Drafts never reach
 * the widget, so a draft status rejects the campaign like any unknown status.
 */
export const YieldCampaign = Schema.Struct({
  id: CampaignId,
  yieldId: YieldId,
  name: Schema.optionalKey(Schema.NullOr(Schema.String)),
  createdAt: UtcDateTimeFromString,
  status: Schema.Literals(["active", "paused", "ended"]),
  rewardMode: TolerantNullOr(Schema.Literals(["normal", "compound"]), {
    operation,
    field: "rewardMode",
  }),
  rewardRate: TolerantNullOr(CampaignRate, { operation, field: "rewardRate" }),
  rewardToken: Token,
  qualificationConfig: TolerantNullOr(CampaignQualification, {
    operation,
    field: "qualificationConfig",
  }),
  startTime: UtcDateTimeFromString,
  endTime: UtcDateTimeFromString,
  payoutFrequency: TolerantNullOr(
    Schema.Literals([
      "weekly",
      "daily",
      "six_hourly",
      "monthly",
      "end_of_campaign",
    ]),
    { operation, field: "payoutFrequency" }
  ),
  nextPayoutDueAt: Schema.optionalKey(
    TolerantNullableUtcDateTimeFromString({
      operation,
      field: "nextPayoutDueAt",
    })
  ),
  sponsor: Schema.optionalKey(
    TolerantNullOr(CampaignSponsor, { operation, field: "sponsor" })
  ),
  termsUrl: Schema.optionalKey(
    TolerantNullOr(HttpsUrl, { operation, field: "termsUrl" })
  ),
});
export type YieldCampaign = typeof YieldCampaign.Type;

const CampaignIdentifier = Schema.Struct({ id: CampaignId }).pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.transform((value) => value.id),
    encode: SchemaGetter.forbidden(() => "Campaign identifier is decode-only"),
  })
);

export const YieldCampaignPage = Schema.Struct({
  // Pagination reads these to request the remaining pages.
  ...Struct.pick(YieldApi.CampaignsControllerGetProjectCampaigns200.fields, [
    "total",
    "offset",
    "limit",
  ]),
  items: Schema.optionalKey(
    TolerantArray(YieldCampaign, { operation, identifier: CampaignIdentifier })
  ),
});

export type CampaignLifecycle =
  | "upcoming"
  | "active"
  | "ending_soon"
  | "paused"
  | "ended";

const endingSoonWindow = Duration.days(14);

/**
 * Where a campaign stands at `now`. The end time wins over a stale API status,
 * and a pause wins over the schedule.
 */
export const getCampaignLifecycle = (
  campaign: YieldCampaign,
  now: DateTime.Utc
): CampaignLifecycle => {
  if (
    campaign.status === "ended" ||
    DateTime.isGreaterThanOrEqualTo(now, campaign.endTime)
  ) {
    return "ended";
  }
  if (campaign.status === "paused") return "paused";
  if (DateTime.isLessThan(now, campaign.startTime)) return "upcoming";
  return Duration.isLessThan(
    DateTime.distance(now, campaign.endTime),
    endingSoonWindow
  )
    ? "ending_soon"
    : "active";
};

export type DisplayedCampaign = {
  readonly campaign: YieldCampaign;
  readonly lifecycle: Exclude<CampaignLifecycle, "ended">;
};

const displayPriority = {
  active: 0,
  ending_soon: 0,
  paused: 1,
  upcoming: 2,
} as const satisfies Record<DisplayedCampaign["lifecycle"], number>;

/**
 * The one campaign a yield shows: a live one before a paused one before an
 * upcoming one, and the newest among equals. The newest live campaign is the
 * one the yield's reward rate includes.
 */
export const getDisplayedCampaign = (
  campaigns: ReadonlyArray<YieldCampaign>,
  now: DateTime.Utc
): DisplayedCampaign | null =>
  campaigns.reduce<DisplayedCampaign | null>((shown, campaign) => {
    const lifecycle = getCampaignLifecycle(campaign, now);
    if (lifecycle === "ended") return shown;
    if (shown === null) return { campaign, lifecycle };

    const priority = displayPriority[lifecycle];
    const shownPriority = displayPriority[shown.lifecycle];
    const replaces =
      priority < shownPriority ||
      (priority === shownPriority &&
        DateTime.isGreaterThan(campaign.createdAt, shown.campaign.createdAt));

    return replaces ? { campaign, lifecycle } : shown;
  }, null);

const year = Duration.days(365);
const month = Duration.divideUnsafe(year, 12);

/** The share of `period` still inside the campaign, at most the whole period. */
const remainingShare = (
  remaining: Duration.Duration,
  period: Duration.Duration
) => {
  const share = exactDecimal(Duration.toMillis(remaining)).dividedBy(
    Duration.toMillis(period)
  );
  return share.isGreaterThan(1) ? exactDecimal(1) : share;
};

/** A campaign as it stands at one moment. */
export type CampaignAtTime = {
  readonly campaign: YieldCampaign;
  readonly now: DateTime.Utc;
};

/** Whether a campaign adds to its yield's rate in this lifecycle state. */
export const isCampaignEarning = (lifecycle: CampaignLifecycle) =>
  lifecycle === "active" || lifecycle === "ending_soon";

/**
 * The campaign a yield's rate includes at `now`: the one it shows, while that
 * one earns; null otherwise.
 */
export const getEarningCampaign = (
  campaigns: ReadonlyArray<YieldCampaign>,
  now: DateTime.Utc
) => {
  const displayed = getDisplayedCampaign(campaigns, now);
  return displayed && isCampaignEarning(displayed.lifecycle)
    ? displayed.campaign
    : null;
};

/**
 * A yield with its earning campaign's Campaign Incentive Rate added when its
 * own rate doesn't list one yet: the API serves yields from a longer cache
 * than campaigns, so for a while after a campaign starts paying, the yield's
 * rate misses it. A rate that lists a campaign part keeps it as given.
 */
export const withCampaignRate = <Y extends Pick<EarnYield, "rewardRate">>(
  yieldDto: Y,
  campaign: YieldCampaign
): Y => {
  const campaignRate = campaign.rewardRate;
  const { rewardRate } = yieldDto;
  if (
    !campaignRate?.total.isGreaterThan(0) ||
    rewardRate.components.some(
      (component) => component.yieldSource === "campaign_incentive"
    )
  ) {
    return yieldDto;
  }

  return {
    ...yieldDto,
    rewardRate: {
      ...rewardRate,
      total: rewardRate.total.plus(campaignRate.total),
      components: [
        ...rewardRate.components,
        {
          rate: campaignRate.total,
          rateType: campaignRate.rateType,
          token: campaign.rewardToken,
          yieldSource: "campaign_incentive",
        },
      ],
    },
  };
};

/**
 * Yearly and monthly earnings on `amount` while a campaign is earning. The
 * Campaign Incentive Rate applies only from the minimum balance, only up to the
 * per-wallet cap, and only for the time the campaign has left. Null when the
 * campaign adds nothing now, so the plain rate applies.
 */
export const getCampaignRewardsEstimate = ({
  amount,
  campaign,
  campaignIncentiveRate,
  now,
  rewardRate,
}: {
  readonly amount: BigNumber;
  readonly campaign: YieldCampaign;
  /** The Campaign Incentive Rate part of `rewardRate`. */
  readonly campaignIncentiveRate: BigNumber;
  readonly now: DateTime.Utc;
  /** The full rate, Campaign Incentive Rate included. */
  readonly rewardRate: BigNumber;
}) => {
  if (
    !isCampaignEarning(getCampaignLifecycle(campaign, now)) ||
    !campaignIncentiveRate.isGreaterThan(0)
  ) {
    return null;
  }

  const qualification = campaign.qualificationConfig;
  const walletCap = qualification?.maxIncentivizedTvlToken;
  const belowMinimum =
    qualification !== null && amount.isLessThan(qualification.threshold);
  const cappedAmount =
    walletCap && amount.isGreaterThan(walletCap) ? walletCap : amount;
  const incentivizedAmount = belowMinimum ? exactZero() : cappedAmount;
  const nativeRate = rewardRate.minus(campaignIncentiveRate);
  const earningNativeRate = nativeRate.isNegative() ? exactZero() : nativeRate;
  const remaining = DateTime.distance(now, campaign.endTime);
  const earningsOver = (period: Duration.Duration) =>
    amount
      .times(earningNativeRate)
      .plus(
        incentivizedAmount
          .times(campaignIncentiveRate)
          .times(remainingShare(remaining, period))
      );

  return {
    yearly: earningsOver(year),
    monthly: earningsOver(month).dividedBy(12),
  } as const;
};

/**
 * Campaign yields first: within each run of same-type yields, which the yield
 * selector shows as one group, and the groups holding one before the rest.
 * Otherwise the given order of groups and of yields within them stays.
 */
export const pinCampaignYields = <Y extends EarnYield>(
  yields: ReadonlyArray<Y>,
  campaignYieldIds: ReadonlySet<YieldId>
): ReadonlyArray<Y> => {
  const runs = yields.reduce<Array<Array<Y>>>((acc, item) => {
    const run = acc.at(-1);
    const type = getExtendedYieldType(item);
    if (run?.[0] && getExtendedYieldType(run[0]) === type) run.push(item);
    else acc.push([item]);
    return acc;
  }, []);
  const pinned = runs.map((run) => [
    ...run.filter((item) => campaignYieldIds.has(item.id)),
    ...run.filter((item) => !campaignYieldIds.has(item.id)),
  ]);
  const hasCampaign = (run: ReadonlyArray<Y>) =>
    !!run[0] && campaignYieldIds.has(run[0].id);

  return [
    ...pinned.filter(hasCampaign),
    ...pinned.filter((run) => !hasCampaign(run)),
  ].flat();
};

/** The share of a campaign's schedule that has passed at `now`, from 0 to 1. */
export const getCampaignProgress = (
  campaign: YieldCampaign,
  now: DateTime.Utc
) => {
  const elapsed =
    Duration.toMillis(DateTime.distance(campaign.startTime, now)) /
    Duration.toMillis(DateTime.distance(campaign.startTime, campaign.endTime));
  return Math.min(1, Math.max(0, elapsed));
};

/**
 * A yield's Rate Composition as its shown campaign stands. While the campaign
 * earns, its part is the one the rate lists; before it starts, its planned
 * rate, which today's total doesn't include yet; while paused, none.
 */
export type CampaignRateComposition = RateComposition & {
  /** The total with the campaign part in it, from the start when upcoming. */
  readonly withCampaign: BigNumber;
};

export const getCampaignRateComposition = (
  rewardRate: YieldRewardRate,
  { campaign, lifecycle }: DisplayedCampaign
): CampaignRateComposition => {
  const composition = getRateComposition(rewardRate);
  const total = composition.total.rate;
  switch (lifecycle) {
    case "active":
    case "ending_soon":
      return { ...composition, withCampaign: total };
    case "upcoming": {
      const planned = campaign.rewardRate?.total.isGreaterThan(0)
        ? campaign.rewardRate
        : null;
      return {
        ...composition,
        campaign: planned
          ? { rate: planned.total, rateType: planned.rateType }
          : null,
        withCampaign: total.plus(planned?.total ?? 0),
      };
    }
    case "paused":
      return { ...composition, campaign: null, withCampaign: total };
  }
};
