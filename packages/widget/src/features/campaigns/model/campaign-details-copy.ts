import type { TFunction } from "i18next";

import { getCampaignMinimum } from "../../../domain/earn/campaign";
import type { Token } from "../../../domain/token/token";
import { formatTokenAmount } from "../../../shared/lib/number-format";
import type { YieldCampaignView } from "./yield-campaign-view";

/** Who funds the campaign, and its terms; null without either. */
export const getCampaignAboutModel = (
  view: YieldCampaignView,
  t: TFunction
) => {
  const { sponsor, termsUrl } = view.campaign;
  if (!sponsor && !termsUrl) return null;

  return {
    sponsor: sponsor
      ? t("campaign.details.funded_by", { sponsor: sponsor.name })
      : null,
    termsUrl: termsUrl ?? null,
  };
};

/**
 * The balance rules among the campaign's details, in the yield's token: its
 * Campaign Minimum and its per-wallet cap, each only when the campaign has
 * one. They hold in every lifecycle state the details show.
 */
export const getCampaignBalanceRules = (
  view: YieldCampaignView,
  yieldToken: Token,
  t: TFunction,
  locale: string
) => {
  const minimum = getCampaignMinimum(view.campaign);
  const cap = view.campaign.qualificationConfig?.maxIncentivizedTvlToken;

  return [
    ...(minimum
      ? [
          {
            id: "minimum",
            label: t("campaign.details.minimum"),
            // Rounded up, so the shown minimum is never short of the rule.
            value: `${formatTokenAmount(minimum, locale, "up")} ${yieldToken.symbol}`,
            caption: t("campaign.details.minimum_caption"),
          },
        ]
      : []),
    ...(cap?.isGreaterThan(0)
      ? [
          {
            id: "cap",
            label: t("campaign.details.cap"),
            // Rounded down, so the shown cap never overstates it.
            value: `${formatTokenAmount(cap, locale, "down")} ${yieldToken.symbol}`,
            caption: t("campaign.details.cap_caption"),
          },
        ]
      : []),
  ];
};
