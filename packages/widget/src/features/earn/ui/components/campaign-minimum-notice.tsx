import { useTranslation } from "react-i18next";

import { formatTokenAmount } from "../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../shared/react/widget-presentation";
import { Notice } from "../../../../ui/index";
import { useEarnEntry } from "../use-earn-facades";

/**
 * Under the amount, what it means for the selected yield's earning Campaign:
 * how much more reaches its Campaign Minimum, or that the campaign excludes
 * the wallet. Either way the entry goes ahead at the yield's own rate.
 */
export const EarnCampaignMinimumNotice = () => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const { view } = useEarnEntry();
  const notice = view.campaignNotice;

  if (!notice) return null;
  if (notice._tag === "NotEligible") {
    return (
      <Notice
        tone="neutral"
        title={t("campaign.rewards.notice.not_eligible_title")}
        testId="earn-campaign-notice"
      >
        {t("campaign.rewards.notice.not_eligible")}
      </Notice>
    );
  }

  // Both are what the wallet needs, so neither may read short of it.
  const { symbol } = notice.token;
  return (
    <Notice tone="info" testId="earn-campaign-notice">
      {t("campaign.entry.below_minimum", {
        shortfall: `${formatTokenAmount(notice.shortfall, locale, "up")} ${symbol}`,
        minimum: `${formatTokenAmount(notice.minimum, locale, "up")} ${symbol}`,
      })}
    </Notice>
  );
};
