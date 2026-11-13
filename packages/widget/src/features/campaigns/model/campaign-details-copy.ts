import type { TFunction } from "i18next";

import type { EarnYieldWithProvider } from "../../../domain/earn/yield-schema";
import { formatCampaignDate } from "./campaign-copy";
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
