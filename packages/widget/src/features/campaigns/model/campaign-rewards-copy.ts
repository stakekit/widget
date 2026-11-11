import type BigNumber from "bignumber.js";
import type { DateTime } from "effect";
import type { TFunction } from "i18next";

import {
  type CampaignPayout,
  type CampaignQualificationState,
  getCampaignPayoutAmount,
  getCampaignQualificationState,
  type CampaignRewardsStage,
  getCampaignRewardsAmounts,
} from "../../../domain/earn/campaign-rewards";
import type { Token } from "../../../domain/token/token";
import { formatDateTime } from "../../../shared/lib/date";
import { formatTokenAmountWithSymbol } from "../../../shared/lib/number-format";
import { formatCampaignDate } from "./campaign-copy";
import type {
  PositionCampaignRow,
  ReadyCampaignRewardsView,
} from "./campaign-rewards-view";

type RewardsMetric = {
  readonly id: "earned" | "paid" | "pending";
  readonly label: string;
  readonly value: string;
  readonly caption?: string;
};

type RewardsNotice = {
  readonly id: string;
  readonly tone: "neutral" | "warning" | "info";
  readonly title?: string;
  readonly text: string;
};

const formatAmount = (amount: BigNumber, token: Token, locale: string) =>
  formatTokenAmountWithSymbol({ amount, token }, locale);

const formatTime = (
  date: DateTime.Utc,
  timeZone: DateTime.TimeZone,
  locale: string
) =>
  formatDateTime(date, {
    locale,
    timeZone,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Whether the wallet can't earn the campaign now, below its minimum or excluded. */
const isBlocked = (state: CampaignQualificationState) =>
  state._tag === "NotEligible" || state._tag === "BelowMinimum";

export type CampaignRowBadgeTone = "accent" | "warning" | "neutral";

/**
 * The row's badge follows the campaign the yield runs now; without one, where
 * the wallet's rewards stand, so an ended campaign reads neutral.
 */
const getRowBadgeTone = (row: PositionCampaignRow): CampaignRowBadgeTone => {
  if (row.lifecycle === "paused") return "warning";
  if (row.lifecycle) return "accent";
  switch (row.rewards?.stage) {
    case "paused":
      return "warning";
    case "earning":
      return "accent";
    default:
      return "neutral";
  }
};

/**
 * A campaign position's row: its badge, and what the wallet earned there,
 * or why it doesn't earn when it earned nothing. The badge stays while the
 * rewards load or fail.
 */
export const getCampaignRowModel = (
  row: PositionCampaignRow,
  yieldToken: Token,
  t: TFunction,
  locale: string
) => {
  const rewards = row.rewards?.rewards ?? null;
  const state = rewards ? getCampaignQualificationState(rewards, null) : null;
  const amounts = rewards
    ? getCampaignRewardsAmounts(rewards, yieldToken)
    : null;
  const notEarning =
    state !== null && isBlocked(state) && amounts?.earned.isZero() === true;

  const getLine = () => {
    if (!amounts || !state) return null;
    if (!notEarning) {
      return {
        label: t("campaign.rewards.earned_line"),
        value: formatAmount(amounts.earned, amounts.token, locale),
      };
    }
    return {
      label: t("campaign.rewards.title"),
      value:
        state._tag === "NotEligible"
          ? t("campaign.rewards.row_not_earning")
          : t("campaign.rewards.row_below_minimum"),
    };
  };

  return { badgeTone: getRowBadgeTone(row), line: getLine() };
};

const getUnpaidMetric = (
  view: ReadyCampaignRewardsView,
  unpaid: string,
  t: TFunction,
  locale: string
): RewardsMetric => {
  const { nextPayoutDueAt } = view.rewards;
  const due = nextPayoutDueAt
    ? formatCampaignDate(nextPayoutDueAt, view.timeZone, locale)
    : null;

  switch (view.stage) {
    case "paused":
      return {
        id: "pending",
        label: t("campaign.rewards.pending"),
        value: unpaid,
        caption: t("campaign.rewards.paused_caption"),
      };
    case "final_payout_pending":
      return {
        id: "pending",
        label: t("campaign.rewards.final_payout"),
        value: unpaid,
        caption: due
          ? t("campaign.rewards.final_payout_due", { date: due })
          : t("campaign.rewards.final_payout_preparing"),
      };
    case "earning":
      return {
        id: "pending",
        label: t("campaign.rewards.pending"),
        value: unpaid,
        ...(due
          ? { caption: t("campaign.rewards.next_payout", { date: due }) }
          : {}),
      };
    case "paid_out":
      return {
        id: "pending",
        label: t("campaign.rewards.pending"),
        value: unpaid,
      };
  }
};

const getQualificationNotice = (
  state: CampaignQualificationState,
  yieldToken: Token,
  t: TFunction,
  locale: string
): RewardsNotice | null => {
  switch (state._tag) {
    case "NotEligible":
      return {
        id: "not-eligible",
        tone: "neutral",
        title: t("campaign.rewards.notice.not_eligible_title"),
        text: t("campaign.rewards.notice.not_eligible"),
      };
    case "BelowMinimum": {
      const { minimum, shortfall } = state;
      return {
        id: "below-minimum",
        tone: "warning",
        title: t("campaign.rewards.notice.below_minimum_title"),
        text:
          minimum && shortfall
            ? t("campaign.rewards.notice.below_minimum", {
                shortfall: formatAmount(shortfall, yieldToken, locale),
                minimum: formatAmount(minimum, yieldToken, locale),
              })
            : t("campaign.rewards.notice.below_minimum_unknown"),
      };
    }
    case "OverCap":
      return {
        id: "over-cap",
        tone: "info",
        text: t("campaign.rewards.notice.over_cap", {
          cap: formatAmount(state.cap, yieldToken, locale),
          rest: formatAmount(state.uncapped, yieldToken, locale),
        }),
      };
    case "Earning":
    case "Unknown":
      return null;
  }
};

const getStageNotice = (
  stage: CampaignRewardsStage,
  t: TFunction
): RewardsNotice | null => {
  switch (stage) {
    case "paused":
      return {
        id: "paused",
        tone: "warning",
        text: t("campaign.rewards.notice.paused"),
      };
    case "final_payout_pending":
      return {
        id: "final-payout",
        tone: "neutral",
        text: t("campaign.rewards.notice.final_payout"),
      };
    case "paid_out":
      return {
        id: "paid-out",
        tone: "neutral",
        text: t("campaign.rewards.notice.paid_out"),
      };
    case "earning":
      return null;
  }
};

const getEarnedMetric = (
  view: ReadyCampaignRewardsView,
  earned: string,
  t: TFunction,
  locale: string
): RewardsMetric => {
  const base = {
    id: "earned",
    label: t("campaign.rewards.total_earned"),
    value: earned,
  } as const;
  if (!view.campaign) return base;
  return {
    ...base,
    caption: t("campaign.rewards.since", {
      date: formatCampaignDate(view.campaign.startTime, view.timeZone, locale),
    }),
  };
};

const getFreshness = (
  view: ReadyCampaignRewardsView,
  t: TFunction,
  locale: string
) => {
  const { accruedThrough } = view.rewards;
  if (!accruedThrough) return null;
  const date = formatTime(accruedThrough, view.timeZone, locale);
  return view.stale
    ? t("campaign.rewards.last_updated", { date })
    : t("campaign.rewards.updated", { date });
};

/**
 * What a position's Campaign rewards section says: the totals over the whole
 * campaign, why the wallet does or doesn't earn, where the campaign stands,
 * and how fresh the figures are. A wallet that earned nothing and can't earn
 * shows its notice without empty totals.
 */
export const getCampaignRewardsSectionModel = (
  view: ReadyCampaignRewardsView,
  yieldToken: Token,
  t: TFunction,
  locale: string
) => {
  const { rewards } = view;
  const amounts = getCampaignRewardsAmounts(rewards, yieldToken);
  const state = getCampaignQualificationState(
    rewards,
    view.campaign?.qualificationConfig?.threshold ?? null
  );
  const showsTotals = !(isBlocked(state) && amounts.earned.isZero());
  const paidIntoPosition =
    rewards.rewardMode === "compound" &&
    rewards.inputTokenTotals?.paid.isGreaterThan(0)
      ? rewards.inputTokenTotals.paid
      : null;
  const metrics: ReadonlyArray<RewardsMetric> = [
    getEarnedMetric(
      view,
      formatAmount(amounts.earned, amounts.token, locale),
      t,
      locale
    ),
    {
      id: "paid",
      label: t("campaign.rewards.paid_out"),
      value: formatAmount(amounts.paid, amounts.token, locale),
    },
    getUnpaidMetric(
      view,
      formatAmount(amounts.unpaid, amounts.token, locale),
      t,
      locale
    ),
  ];

  return {
    metrics: showsTotals ? metrics : [],
    notices: [
      getQualificationNotice(state, yieldToken, t, locale),
      getStageNotice(view.stage, t),
    ].filter((notice): notice is RewardsNotice => notice !== null),
    compoundNote: paidIntoPosition
      ? t("campaign.rewards.compound_payouts", {
          symbol: rewards.rewardToken.symbol,
          amount: formatAmount(paidIntoPosition, yieldToken, locale),
        })
      : null,
    freshness: getFreshness(view, t, locale),
  };
};

/** One payout row: its date, or "Pending", its amount, and its reward-token amount. */
export const getCampaignPayoutRow = (
  payout: CampaignPayout,
  view: ReadyCampaignRewardsView,
  yieldToken: Token,
  t: TFunction,
  locale: string
) => {
  const { rewards } = view;
  const shown = getCampaignPayoutAmount(payout, rewards, yieldToken);
  const shownInYieldToken = shown.token !== rewards.rewardToken;

  return {
    label:
      payout.status === "pending" || !payout.paidAt
        ? t("campaign.rewards.payouts.pending")
        : formatCampaignDate(payout.paidAt, view.timeZone, locale),
    value: `+${formatAmount(shown.amount, shown.token, locale)}`,
    ...(shownInYieldToken
      ? { caption: formatAmount(payout.amount, rewards.rewardToken, locale) }
      : {}),
  };
};
