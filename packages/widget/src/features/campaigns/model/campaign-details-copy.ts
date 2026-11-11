import type BigNumber from "bignumber.js";
import type { TFunction } from "i18next";

import {
  type CampaignCeilingPlan,
  type CampaignCeilingTrigger,
  getCampaignCeilingPlan,
} from "../../../domain/earn/campaign";
import type { EarnYieldWithProvider } from "../../../domain/earn/yield-schema";
import {
  formatRewardRatePercent,
  formatTokenAmountWithSymbol,
} from "../../../shared/lib/number-format";
import {
  formatCampaignDate,
  formatRateType,
  getCampaignRates,
} from "./campaign-copy";
import type { YieldCampaignView } from "./yield-campaign-view";

/** Who funds the campaign and what it is, with its terms; null without a sponsor or terms. */
export const getCampaignAboutModel = (
  view: YieldCampaignView,
  yieldDto: EarnYieldWithProvider,
  t: TFunction,
  locale: string
) => {
  const { sponsor, termsUrl, startTime, endTime } = view.campaign;
  if (!sponsor && !termsUrl) return null;

  return {
    sponsor: sponsor
      ? {
          fundedBy: t("campaign.details.funded_by", { sponsor: sponsor.name }),
          logoURI: sponsor.logoURI,
          name: sponsor.name,
          text: t("campaign.details.about_text", {
            sponsor: sponsor.name,
            yield: yieldDto.metadata.name,
            start: formatCampaignDate(startTime, view.timeZone, locale),
            end: formatCampaignDate(endTime, view.timeZone, locale),
          }),
        }
      : null,
    termsUrl: termsUrl ?? null,
  };
};

type CeilingFormat = {
  readonly percent: (rate: BigNumber) => string;
  readonly amount: (amount: BigNumber) => string;
  readonly date: (trigger: CampaignCeilingTrigger["date"] & {}) => string;
};

/** "After deposits average 10M USDC", "From May 1, 2027", or both. */
const formatStepTrigger = (
  trigger: CampaignCeilingTrigger | null,
  format: CeilingFormat,
  t: TFunction
) => {
  if (trigger?.deposits && trigger.date) {
    return t("campaign.details.ceiling.step_deposits_or_date", {
      amount: format.amount(trigger.deposits),
      date: format.date(trigger.date),
    });
  }
  if (trigger?.deposits) {
    return t("campaign.details.ceiling.step_deposits", {
      amount: format.amount(trigger.deposits),
    });
  }
  if (trigger?.date) {
    return t("campaign.details.ceiling.step_date", {
      date: format.date(trigger.date),
    });
  }
  return t("campaign.details.ceiling.step_start");
};

/**
 * Why the ceiling moved, under the step plan: deposits when only deposits could
 * move it, else when the step was reached, else just the new ceiling. The ceiling
 * it moved from is named when the plan still knows it.
 */
const formatSteppedDown = (
  moved: NonNullable<CampaignCeilingPlan["steppedDown"]>,
  ceiling: string,
  format: CeilingFormat,
  t: TFunction
) => {
  const from = moved.from ? format.percent(moved.from) : null;
  const date = moved.reachedAt ?? moved.trigger.date;
  if (moved.trigger.deposits && !moved.trigger.date) {
    const amount = format.amount(moved.trigger.deposits);
    return from
      ? t("campaign.details.ceiling.stepped_down_deposits", {
          amount,
          ceiling,
          from,
        })
      : t("campaign.details.ceiling.stepped_down_deposits_now", {
          amount,
          ceiling,
        });
  }
  if (date) {
    const day = format.date(date);
    return from
      ? t("campaign.details.ceiling.stepped_down_date", {
          date: day,
          ceiling,
          from,
        })
      : t("campaign.details.ceiling.stepped_down_date_now", {
          date: day,
          ceiling,
        });
  }
  return from
    ? t("campaign.details.ceiling.stepped_down", { ceiling, from })
    : t("campaign.details.ceiling.stepped_down_now", { ceiling });
};

/**
 * The campaign's ceiling as the dialog explains it: what it limits, the plan of
 * steps with the current one marked and replaced ones struck, and why the
 * ceiling moved once a step lowered it. Null without a ceiling the widget can name.
 */
export const getCampaignCeilingModel = (
  view: YieldCampaignView,
  yieldDto: EarnYieldWithProvider,
  t: TFunction,
  locale: string
) => {
  const plan = getCampaignCeilingPlan(view.campaign);
  if (!plan) return null;

  const format: CeilingFormat = {
    percent: (rate) => formatRewardRatePercent(rate, locale),
    amount: (amount) =>
      formatTokenAmountWithSymbol({ amount, token: yieldDto.token }, locale),
    date: (date) => formatCampaignDate(date, view.timeZone, locale),
  };
  const ceiling = format.percent(plan.current);
  // The total rate's type for a ceiling on the total; the campaign rate's for a
  // ceiling on the campaign part alone.
  const rateType = formatRateType(
    plan.mode === "combined"
      ? yieldDto.rewardRate.rateType
      : getCampaignRates(view, yieldDto).campaignRateType
  );
  const label = t("campaign.details.ceiling.label", {
    context: plan.mode,
    rateType,
  });
  const moved = plan.steppedDown;
  const from = moved?.from ? format.percent(moved.from) : null;

  return {
    label,
    ceiling,
    explanation: t("campaign.details.ceiling.explanation", {
      context: plan.mode,
      rateType,
      ceiling,
    }),
    steps: plan.steps.map((step, index) => ({
      id: `${index}`,
      label: formatStepTrigger(step.trigger, format, t),
      value: format.percent(step.ceiling),
      current: step.state === "current",
      struck: step.state === "past",
    })),
    stepsNote: plan.steps.some((step) => step.trigger?.deposits)
      ? t("campaign.details.ceiling.steps_note")
      : null,
    steppedDown: moved
      ? {
          title: t("campaign.details.ceiling.stepped_down_title", {
            rateType,
            ceiling,
          }),
          text: formatSteppedDown(moved, ceiling, format, t),
          // Where no step plan follows, such as the Dashboard's section.
          summary: from
            ? t("campaign.details.ceiling.section_stepped_down", {
                label,
                ceiling,
                from,
              })
            : t("campaign.details.ceiling.section_stepped_down_now", {
                label,
                ceiling,
              }),
        }
      : null,
  };
};
