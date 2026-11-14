import type { TFunction } from "i18next";

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
