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
 * A step of a campaign's ceiling plan: once deposits average `twTvlThreshold`
 * (with enough TVL-years) or `unlockAfter` passes, `apyCeiling` replaces
 * the ceiling.
 */
const CampaignMilestone = Schema.Struct({
  order: Schema.Finite,
  apyCeiling: TolerantNullOr(NonNegativeExactDecimal, {
    operation,
    field: "milestones.apyCeiling",
  }),
  twTvlThreshold: TolerantNullOr(NonNegativeExactDecimal, {
    operation,
    field: "milestones.twTvlThreshold",
  }),
  unlockAfter: TolerantNullableUtcDateTimeFromString({
    operation,
    field: "milestones.unlockAfter",
  }),
  status: Schema.Literals(["locked", "unlocked", "funded"]),
  unlockedAt: Schema.optionalKey(
    TolerantNullableUtcDateTimeFromString({
      operation,
      field: "milestones.unlockedAt",
    })
  ),
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
  /** The current ceiling: a reached step overwrites it. */
  apyCeiling: Schema.optionalKey(
    TolerantNullOr(NonNegativeExactDecimal, { operation, field: "apyCeiling" })
  ),
  /** `incentive` caps the campaign rate; `combined`, the whole rate. */
  apyCeilingMode: Schema.optionalKey(
    TolerantNullOr(Schema.Literals(["incentive", "combined"]), {
      operation,
      field: "apyCeilingMode",
    })
  ),
  milestones: Schema.optionalKey(
    TolerantArray(CampaignMilestone, { operation })
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

const day = Duration.days(1);

/** Whole days, rounded up, from `from` to `to`; zero once `to` has passed. */
const daysUntil = (from: DateTime.Utc, to: DateTime.Utc) =>
  Math.max(
    0,
    Math.ceil(
      Duration.toMillis(DateTime.distance(from, to)) / Duration.toMillis(day)
    )
  );

/**
 * How far a campaign has run at `now`, for its timeline: the elapsed share,
 * whole days left and to the start, and the day it is on out of its length
 * (0 before it starts).
 */
export const getCampaignTimeline = (
  campaign: YieldCampaign,
  now: DateTime.Utc
) => {
  const elapsed =
    Duration.toMillis(DateTime.distance(campaign.startTime, now)) /
    Duration.toMillis(DateTime.distance(campaign.startTime, campaign.endTime));
  const durationDays = daysUntil(campaign.startTime, campaign.endTime);

  return {
    elapsed: Math.min(1, Math.max(0, elapsed)),
    daysLeft: daysUntil(
      DateTime.max(now, campaign.startTime),
      campaign.endTime
    ),
    daysUntilStart: daysUntil(now, campaign.startTime),
    day: Math.min(
      durationDays,
      daysUntil(campaign.startTime, DateTime.max(now, campaign.startTime))
    ),
    durationDays,
  } as const;
};

/**
 * What moves a campaign's ceiling to a step: deposits averaging an amount (in the
 * yield's token, over 14 days and long enough), a date, or whichever comes
 * first. Neither is set for the ceiling the campaign starts with.
 */
export type CampaignCeilingTrigger = {
  readonly deposits: BigNumber | null;
  readonly date: DateTime.Utc | null;
};

type CampaignCeilingStep = {
  readonly ceiling: BigNumber;
  /** Null for the ceiling the campaign starts with. */
  readonly trigger: CampaignCeilingTrigger | null;
  /** `past` steps were replaced by a later one. */
  readonly state: "past" | "current" | "next";
};

export type CampaignCeilingPlan = {
  readonly mode: "incentive" | "combined";
  readonly current: BigNumber;
  /** The plan; empty when the campaign has no steps. */
  readonly steps: ReadonlyArray<CampaignCeilingStep>;
  /** The step that set the current ceiling, and the one it replaced if known. */
  readonly steppedDown: {
    readonly trigger: CampaignCeilingTrigger;
    readonly reachedAt: DateTime.Utc | null;
    readonly from: BigNumber | null;
  } | null;
};

// The step at `position` (counted from 1) against how many steps are reached.
const stepState = (
  position: number,
  reachedCount: number
): CampaignCeilingStep["state"] => {
  if (position < reachedCount) return "past";
  if (position === reachedCount) return "current";
  return "next";
};

/**
 * A campaign's Campaign Rate Ceiling and how it steps: the steps that change it, in unlock
 * order, the reached ones before the current one marked past. Reaching a
 * step overwrites the starting ceiling, so the plan shows it only before then.
 * Null without a ceiling, or when the API names a mode the widget doesn't know,
 * since the ceiling could then read as limiting the wrong rate.
 */
export const getCampaignCeilingPlan = (
  campaign: YieldCampaign
): CampaignCeilingPlan | null => {
  const current = campaign.apyCeiling;
  const mode = campaign.apyCeilingMode;
  if (!current || !mode) return null;

  const ceilingSteps = [...(campaign.milestones ?? [])]
    .sort((a, b) => a.order - b.order)
    .flatMap((milestone) =>
      milestone.apyCeiling ? [{ ceiling: milestone.apyCeiling, milestone }] : []
    );
  const reachedCount = ceilingSteps.filter(
    ({ milestone }) => milestone.status !== "locked"
  ).length;
  const milestoneSteps = ceilingSteps.map(
    ({ ceiling, milestone }, index): CampaignCeilingStep => ({
      ceiling,
      trigger: {
        deposits: milestone.twTvlThreshold,
        date: milestone.unlockAfter,
      },
      state: stepState(index + 1, reachedCount),
    })
  );
  const last = ceilingSteps[reachedCount - 1];
  const startStep: CampaignCeilingStep = {
    ceiling: current,
    trigger: null,
    state: "current",
  };
  // Until a step is reached, the plan starts at the configured ceiling.
  const startSteps =
    reachedCount === 0 && milestoneSteps.length > 0 ? [startStep] : [];

  return {
    mode,
    current,
    steps: [...startSteps, ...milestoneSteps],
    steppedDown: last
      ? {
          trigger: {
            deposits: last.milestone.twTvlThreshold,
            date: last.milestone.unlockAfter,
          },
          reachedAt: last.milestone.unlockedAt ?? null,
          from: ceilingSteps[reachedCount - 2]?.ceiling ?? null,
        }
      : null,
  };
};
