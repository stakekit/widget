import type { DateTime } from "effect";
import type { TFunction } from "i18next";

import { getCampaignRateComposition } from "../../../domain/earn/campaign";
import type { RateComposition } from "../../../domain/earn/reward-rate";
import type { EarnYieldWithProvider } from "../../../domain/earn/yield-schema";
import { formatDateTime } from "../../../shared/lib/date";
import {
  formatRewardRatePercent,
  unavailableFigure,
} from "../../../shared/lib/number-format";
import { formatRewardRateLabel } from "../../yield-presentation/index";
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

/** "Ends May 15, 2027", and its upcoming and paused forms. */
export const getCampaignScheduleLine = (
  view: YieldCampaignView,
  t: TFunction,
  locale: string
) => {
  const { campaign, timeZone } = view;
  switch (view.lifecycle) {
    case "upcoming":
      return t("campaign.time.upcoming", {
        date: formatCampaignDate(campaign.startTime, timeZone, locale),
      });
    case "paused":
      return t("campaign.time.paused", {
        date: formatCampaignDate(campaign.endTime, timeZone, locale),
      });
    case "active":
    case "ending_soon":
      return t("campaign.time.active", {
        date: formatCampaignDate(campaign.endTime, timeZone, locale),
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
  composition: RateComposition,
  t: TFunction,
  locale: string
) => {
  const { campaign } = composition;
  const rate = campaign ? formatRewardRatePercent(campaign.rate, locale) : null;
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
  composition: RateComposition,
  t: TFunction,
  locale: string
) => {
  const { campaign } = composition;
  const rate = campaign ? formatRewardRatePercent(campaign.rate, locale) : null;
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
  const { campaign } = getCampaignRateComposition(yieldDto.rewardRate, view);
  const rate = campaign ? formatRewardRatePercent(campaign.rate, locale) : null;
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
 * The offer of `yieldDto`'s earning campaign beside a yield without one: the
 * rate with it, and the yield by its provider when the yield names one.
 */
export const getCampaignOfferText = (
  view: YieldCampaignView,
  yieldDto: EarnYieldWithProvider,
  t: TFunction,
  locale: string
) => {
  const provider = yieldDto.provider?.name;
  return t("campaign.offer.text", {
    ...(provider ? { provider, context: "provider" } : {}),
    name: yieldDto.metadata.name,
    rate: formatRewardRatePercent(
      getCampaignRateComposition(yieldDto.rewardRate, view).withCampaign,
      locale
    ),
    rateType: formatRewardRateLabel(yieldDto, t),
  });
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
  const incentive = getCampaignRateComposition(
    yieldDto.rewardRate,
    view
  ).campaign;
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
            rate: formatRewardRatePercent(incentive.rate, locale),
          })
        : null;
  }
};

/**
 * "Daily, added to your position", for a payouts row; without a schedule,
 * where the rewards go alone.
 */
export const getCampaignPayouts = (view: YieldCampaignView, t: TFunction) => {
  const { payoutFrequency, rewardMode, rewardToken } = view.campaign;
  const mode = rewardMode === "normal" ? "normal" : "compound";
  return payoutFrequency
    ? t(`campaign.section.payouts_${mode}`, {
        frequency: t(`campaign.frequency.${payoutFrequency}`),
        symbol: rewardToken.symbol,
      })
    : t(`campaign.section.payouts_${mode}_unscheduled`, {
        symbol: rewardToken.symbol,
      });
};

/** The details section's note for a campaign that is not earning. */
export const getCampaignSectionNotice = (
  view: YieldCampaignView,
  t: TFunction,
  locale: string
) => {
  const { campaign, timeZone } = view;
  switch (view.lifecycle) {
    case "upcoming":
      return {
        tone: "neutral",
        text: t("campaign.section.notice_upcoming", {
          date: formatCampaignDate(campaign.startTime, timeZone, locale),
        }),
      } as const;
    case "paused":
      return {
        tone: "warning",
        text: t("campaign.section.notice_paused"),
      } as const;
    case "active":
    case "ending_soon":
      return null;
  }
};

/** Under a progress bar: the campaign's start and end dates. */
export const getCampaignProgressScale = (
  view: YieldCampaignView,
  locale: string
) => ({
  start: formatCampaignDate(view.campaign.startTime, view.timeZone, locale),
  end: formatCampaignDate(view.campaign.endTime, view.timeZone, locale),
});

/** Under the payouts row: the next payout, or why there is none. */
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
