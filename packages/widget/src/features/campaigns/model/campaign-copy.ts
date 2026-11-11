import type BigNumber from "bignumber.js";
import type { DateTime } from "effect";
import type { TFunction } from "i18next";

import {
  getCampaignTimeline,
  isCampaignEarning,
} from "../../../domain/earn/campaign";
import { getCampaignIncentiveRate } from "../../../domain/earn/reward-rate";
import type { EarnYieldWithProvider } from "../../../domain/earn/yield-schema";
import { formatDateTime } from "../../../shared/lib/date";
import { getRewardTypeFormatted } from "../../../shared/lib/formatters";
import {
  formatRewardRatePercent,
  unavailableFigure,
} from "../../../shared/lib/number-format";
import type { YieldCampaignView } from "./yield-campaign-view";

type Lifecycle = YieldCampaignView["lifecycle"];

export const formatCampaignDate = (
  date: DateTime.Utc,
  timeZone: DateTime.TimeZone,
  locale: string
) =>
  formatDateTime(date, {
    locale,
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/** The day and month alone, for a date beside a rate: "Nov 18". */
const formatCampaignDay = (
  date: DateTime.Utc,
  timeZone: DateTime.TimeZone,
  locale: string
) => formatDateTime(date, { locale, timeZone, day: "numeric", month: "short" });

/** The campaign's name, or the yield's when the campaign has none. */
export const getCampaignName = (
  view: YieldCampaignView,
  yieldDto: EarnYieldWithProvider
) => view.campaign.name ?? yieldDto.metadata.name;

/**
 * A yield's rate split into its own part and its campaign's. While the
 * campaign earns, its part is the Campaign Incentive Rate the yield's rate
 * includes, so every figure matches the headline; before it starts, it is
 * the campaign's planned rate on top of the yield's; paused, it is none.
 */
export const getCampaignRates = (
  view: YieldCampaignView,
  yieldDto: EarnYieldWithProvider
): {
  readonly native: BigNumber;
  readonly nativeRateType: string | null;
  readonly campaign: BigNumber | null;
  readonly campaignRateType: string | null;
  readonly total: BigNumber;
} => {
  const { components, rateType } = yieldDto.rewardRate;
  const total = yieldDto.rewardRate.total;
  const nativeRateType =
    components.find(
      (component) => component.yieldSource !== "campaign_incentive"
    )?.rateType ??
    rateType ??
    null;
  const incentiveRateType =
    components.find(
      (component) => component.yieldSource === "campaign_incentive"
    )?.rateType ?? null;
  if (isCampaignEarning(view.lifecycle)) {
    const campaign = getCampaignIncentiveRate(yieldDto.rewardRate);
    return {
      native: total.minus(campaign),
      nativeRateType,
      campaign: campaign.isGreaterThan(0) ? campaign : null,
      campaignRateType: incentiveRateType,
      total,
    };
  }
  const planned =
    view.lifecycle === "upcoming" ? view.campaign.rewardRate : null;
  return {
    native: total,
    nativeRateType,
    campaign: planned?.total.isGreaterThan(0) ? planned.total : null,
    campaignRateType: view.campaign.rewardRate?.rateType ?? incentiveRateType,
    total: planned?.total.isGreaterThan(0) ? total.plus(planned.total) : total,
  };
};

/** The badge a campaign yield carries on Earn: "Campaign", or "Upcoming". */
export const getCampaignBadge = (lifecycle: Lifecycle, t: TFunction) => {
  if (lifecycle === "upcoming") {
    return { label: t("campaign.label_upcoming"), tone: "neutral" } as const;
  }
  return {
    label: t("campaign.label"),
    tone: lifecycle === "paused" ? "warning" : "accent",
  } as const;
};

/** The campaign as a yield header's status badge. */
export const getCampaignStatusBadge = (view: YieldCampaignView, t: TFunction) =>
  ({
    label: t("campaign.label"),
    tone: view.lifecycle === "paused" ? "warning" : "info",
  }) as const;

/** Where the campaign stands, as its details name it: "Live", "Paused"… */
export const getCampaignStatus = (lifecycle: Lifecycle, t: TFunction) => {
  switch (lifecycle) {
    case "active":
      return { label: t("campaign.status_active"), tone: "success" } as const;
    case "upcoming":
      return { label: t("campaign.status_upcoming"), tone: "neutral" } as const;
    case "ending_soon":
      return {
        label: t("campaign.status_ending_soon"),
        tone: "warning",
      } as const;
    case "paused":
      return { label: t("campaign.status_paused"), tone: "warning" } as const;
  }
};

const formatDays = (count: number, t: TFunction) =>
  t("campaign.days", { count });

/** "Ends May 15, 2027 · 153 days left", and its upcoming and paused forms. */
export const getCampaignScheduleLine = (
  view: YieldCampaignView,
  t: TFunction,
  locale: string
) => {
  const { campaign, timeZone } = view;
  const timeline = getCampaignTimeline(campaign, view.now);
  switch (view.lifecycle) {
    case "upcoming":
      return t("campaign.time.upcoming", {
        date: formatCampaignDate(campaign.startTime, timeZone, locale),
        days: formatDays(timeline.daysUntilStart, t),
      });
    case "paused":
      return t("campaign.time.paused", {
        date: formatCampaignDate(campaign.endTime, timeZone, locale),
      });
    case "active":
    case "ending_soon":
      return t("campaign.time.active", {
        date: formatCampaignDate(campaign.endTime, timeZone, locale),
        days: formatDays(timeline.daysLeft, t),
      });
  }
};

/** The note under the Earn strip, for a campaign that is not earning yet. */
export const getCampaignStripNote = (
  view: YieldCampaignView,
  t: TFunction,
  locale: string
) => {
  switch (view.lifecycle) {
    case "upcoming":
      return t("campaign.strip.upcoming_note", {
        date: formatCampaignDate(
          view.campaign.startTime,
          view.timeZone,
          locale
        ),
      });
    case "paused":
      return t("campaign.strip.paused_note");
    case "active":
    case "ending_soon":
      return null;
  }
};

/** The campaign row of a rate's composition: "Up to 4.2%", "Paused"… */
export const getCampaignCompositionValue = (
  view: YieldCampaignView,
  yieldDto: EarnYieldWithProvider,
  t: TFunction,
  locale: string
) => {
  const { campaign } = getCampaignRates(view, yieldDto);
  const rate = campaign ? formatRewardRatePercent(campaign, locale) : null;
  const day = formatCampaignDay(view.campaign.startTime, view.timeZone, locale);
  switch (view.lifecycle) {
    case "paused":
      return t("campaign.rate.paused");
    case "upcoming":
      return rate
        ? t("campaign.rate.up_to_from", { rate, date: day })
        : t("campaign.rate.from", { date: day });
    case "active":
    case "ending_soon":
      return rate ? t("campaign.rate.up_to", { rate }) : unavailableFigure;
  }
};

/** What the campaign adds, as its rate summary words it: "+4.2%", "Paused"… */
export const getCampaignRateSummary = (
  view: YieldCampaignView,
  yieldDto: EarnYieldWithProvider,
  t: TFunction,
  locale: string
) => {
  const { campaign } = getCampaignRates(view, yieldDto);
  const rate = campaign ? formatRewardRatePercent(campaign, locale) : null;
  const day = formatCampaignDay(view.campaign.startTime, view.timeZone, locale);
  switch (view.lifecycle) {
    case "paused":
      return t("campaign.rate.paused");
    case "upcoming":
      return rate
        ? t("campaign.rate.incentive_from", { rate, date: day })
        : t("campaign.rate.from", { date: day });
    case "active":
    case "ending_soon":
      return rate ? t("campaign.rate.incentive", { rate }) : unavailableFigure;
  }
};

/** Under a yield's rate metric: "Incl. +4.2% campaign", and its other forms. */
export const getCampaignMetricCaption = (
  view: YieldCampaignView,
  yieldDto: EarnYieldWithProvider,
  t: TFunction,
  locale: string
) => {
  const { campaign } = getCampaignRates(view, yieldDto);
  const rate = campaign ? formatRewardRatePercent(campaign, locale) : null;
  if (view.lifecycle === "paused") return t("campaign.metric.paused");
  if (!rate) return null;
  return view.lifecycle === "upcoming"
    ? t("campaign.metric.upcoming", {
        rate,
        date: formatCampaignDay(view.campaign.startTime, view.timeZone, locale),
      })
    : t("campaign.metric.active", { rate });
};

/** "paid daily into your position", or how a non-compounding one pays. */
const getPaymentFragment = (view: YieldCampaignView, t: TFunction) => {
  const { payoutFrequency, rewardMode, rewardToken } = view.campaign;
  const mode = rewardMode === "normal" ? "normal" : "compound";
  return payoutFrequency
    ? t(`campaign.payment.${mode}`, {
        cadence: t(`campaign.cadence.${payoutFrequency}`),
        symbol: rewardToken.symbol,
      })
    : t(`campaign.payment.${mode}_no_cadence`, { symbol: rewardToken.symbol });
};

/** `_sponsor` copy names the sponsor; without one, the plain copy reads. */
const sponsorContext = (view: YieldCampaignView) => {
  const sponsor = view.campaign.sponsor?.name;
  return sponsor ? { sponsor, context: "sponsor" } : {};
};

/** The Earn footer's note on how the campaign pays, by its state. */
export const getCampaignFooterNote = (
  view: YieldCampaignView,
  t: TFunction,
  locale: string
) => {
  const { campaign, timeZone } = view;
  const sponsor = sponsorContext(view);
  switch (view.lifecycle) {
    case "paused":
      return t("campaign.footer.paused", sponsor);
    case "upcoming":
      return t("campaign.footer.upcoming", {
        ...sponsor,
        start: formatCampaignDate(campaign.startTime, timeZone, locale),
        end: formatCampaignDate(campaign.endTime, timeZone, locale),
        payment: getPaymentFragment(view, t),
      });
    case "active":
    case "ending_soon":
      return t("campaign.footer.active", {
        ...sponsor,
        date: formatCampaignDate(campaign.endTime, timeZone, locale),
        payment: getPaymentFragment(view, t),
      });
  }
};

/**
 * The hint on a yield without a campaign, pointing to `yieldDto`, which has
 * one: its rate, or that its rewards are paused, and its sponsor if named.
 */
export const getCampaignHint = (
  view: YieldCampaignView,
  yieldDto: EarnYieldWithProvider,
  t: TFunction,
  locale: string
) => {
  const rates = getCampaignRates(view, yieldDto);
  const values = {
    ...sponsorContext(view),
    name: yieldDto.metadata.name,
    rate: formatRewardRatePercent(rates.total, locale),
  };
  switch (view.lifecycle) {
    case "paused":
      return t("campaign.hint.other_yield_paused", values);
    case "upcoming": {
      const date = formatCampaignDay(
        view.campaign.startTime,
        view.timeZone,
        locale
      );
      // Without a planned rate, the yield's own rate would read as the campaign's.
      return rates.campaign
        ? t("campaign.hint.other_yield_upcoming", { ...values, date })
        : t("campaign.hint.other_yield_upcoming_no_rate", { ...values, date });
    }
    case "active":
    case "ending_soon":
      return t("campaign.hint.other_yield", values);
  }
};

/**
 * Under a campaign yield's rate in the selector: what the campaign adds, or
 * when it starts, or that it is paused.
 */
export const getCampaignSelectorNote = (
  view: YieldCampaignView,
  yieldDto: EarnYieldWithProvider,
  t: TFunction,
  locale: string
) => {
  const incentive = getCampaignRates(view, yieldDto).campaign;
  switch (view.lifecycle) {
    case "paused":
      return t("campaign.selector.paused");
    case "upcoming":
      return t("campaign.selector.upcoming", {
        date: formatCampaignDay(view.campaign.startTime, view.timeZone, locale),
      });
    case "active":
    case "ending_soon":
      return incentive
        ? t("campaign.selector.incentive", {
            rate: formatRewardRatePercent(incentive, locale),
          })
        : null;
  }
};

/** "Daily, added to your position", for a payouts row. */
export const getCampaignPayouts = (view: YieldCampaignView, t: TFunction) => {
  const { payoutFrequency, rewardMode, rewardToken } = view.campaign;
  if (!payoutFrequency) return null;
  return t(
    rewardMode === "normal"
      ? "campaign.section.payouts_normal"
      : "campaign.section.payouts_compound",
    {
      frequency: t(`campaign.frequency.${payoutFrequency}`),
      symbol: rewardToken.symbol,
    }
  );
};

/** The details section's note for a campaign that is not simply running. */
export const getCampaignSectionNotice = (
  view: YieldCampaignView,
  t: TFunction,
  locale: string
) => {
  const { campaign, timeZone } = view;
  const timeline = getCampaignTimeline(campaign, view.now);
  switch (view.lifecycle) {
    case "upcoming":
      return {
        tone: "neutral",
        text: t("campaign.section.notice_upcoming", {
          date: formatCampaignDate(campaign.startTime, timeZone, locale),
          days: formatDays(timeline.daysUntilStart, t),
        }),
      } as const;
    case "paused":
      return {
        tone: "warning",
        text: t("campaign.section.notice_paused"),
      } as const;
    case "ending_soon":
      return {
        tone: "warning",
        text: t("campaign.section.notice_ending_soon", {
          days: formatDays(timeline.daysLeft, t),
          date: formatCampaignDate(campaign.endTime, timeZone, locale),
        }),
      } as const;
    case "active":
      return null;
  }
};

/** The dialog's note for a campaign that is not simply running. */
export const getCampaignDialogNotice = (
  view: YieldCampaignView,
  t: TFunction,
  locale: string
) => {
  const { campaign, timeZone } = view;
  const timeline = getCampaignTimeline(campaign, view.now);
  switch (view.lifecycle) {
    case "upcoming":
      return {
        tone: "neutral",
        title: t("campaign.details.notice.upcoming_title", {
          date: formatCampaignDate(campaign.startTime, timeZone, locale),
        }),
        body: campaign.rewardRate?.total.isGreaterThan(0)
          ? t("campaign.details.notice.upcoming")
          : t("campaign.details.notice.upcoming_no_rate"),
      } as const;
    case "paused":
      return {
        tone: "warning",
        title: t("campaign.details.notice.paused_title"),
        body: t("campaign.details.notice.paused"),
      } as const;
    case "ending_soon":
      return {
        tone: "warning",
        title: t("campaign.details.notice.ending_soon_title", {
          days: formatDays(timeline.daysLeft, t),
        }),
        body: t("campaign.details.notice.ending_soon", {
          date: formatCampaignDate(campaign.endTime, timeZone, locale),
        }),
      } as const;
    case "active":
      return null;
  }
};

/** Under the dialog's progress bar: where the campaign stands and its day. */
export const getCampaignProgressScale = (
  view: YieldCampaignView,
  t: TFunction
) => {
  const timeline = getCampaignTimeline(view.campaign, view.now);
  const days = (count: number) => formatDays(count, t);
  switch (view.lifecycle) {
    case "upcoming":
      return {
        start: t("campaign.details.starts_in", {
          days: days(timeline.daysUntilStart),
        }),
        end: t("campaign.details.runs", { days: days(timeline.durationDays) }),
      };
    case "paused":
      return {
        start: t("campaign.details.paused_until_end", {
          days: days(timeline.daysLeft),
        }),
        end: t("campaign.details.day_of", {
          day: timeline.day,
          total: timeline.durationDays,
        }),
      };
    case "active":
    case "ending_soon":
      return {
        start: t("campaign.details.days_left", {
          days: days(timeline.daysLeft),
        }),
        end: t("campaign.details.day_of", {
          day: timeline.day,
          total: timeline.durationDays,
        }),
      };
  }
};

/** Under the dialog's payouts row: the next payout, or why there is none. */
export const getCampaignPayoutCaption = (
  view: YieldCampaignView,
  t: TFunction,
  locale: string
) => {
  const { nextPayoutDueAt } = view.campaign;
  switch (view.lifecycle) {
    case "paused":
      return t("campaign.details.payouts_resume");
    case "upcoming":
      return t("campaign.details.first_payout");
    case "active":
    case "ending_soon":
      return nextPayoutDueAt
        ? t("campaign.details.next_payout", {
            date: formatCampaignDate(nextPayoutDueAt, view.timeZone, locale),
          })
        : undefined;
  }
};

/** The campaign tile's caption in the dialog's composition. */
export const getCampaignRateCaption = (
  view: YieldCampaignView,
  t: TFunction,
  locale: string
) => {
  switch (view.lifecycle) {
    case "paused":
      return t("campaign.details.campaign_caption_paused");
    case "upcoming":
      return t("campaign.details.campaign_caption_upcoming", {
        date: formatCampaignDay(view.campaign.startTime, view.timeZone, locale),
      });
    case "active":
    case "ending_soon":
      return t("campaign.details.campaign_caption_active");
  }
};

/** How the campaign pays, as one sentence. */
export const getCampaignPaymentSentence = (
  view: YieldCampaignView,
  t: TFunction
) => {
  const { payoutFrequency, rewardMode, rewardToken } = view.campaign;
  const mode = rewardMode === "normal" ? "normal" : "compound";
  const values = { symbol: rewardToken.symbol, name: rewardToken.name };
  return payoutFrequency
    ? t(`campaign.details.payment_${mode}`, {
        ...values,
        cadence: t(`campaign.cadence.${payoutFrequency}`),
      })
    : t(`campaign.details.payment_${mode}_no_cadence`, values);
};

/** A rate type as a label reads it: "APR". */
export const formatRateType = (rateType: string | null | undefined) =>
  getRewardTypeFormatted(rateType ?? undefined) ?? "";
