import { useTranslation } from "react-i18next";

import { formatTokenAmountWithSymbol } from "../../../../shared/lib/number-format";
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

  return (
    <Notice tone="info" testId="earn-campaign-notice">
      {t("campaign.entry.below_minimum", {
        needed: formatTokenAmountWithSymbol(
          { amount: notice.needed, token: notice.token },
          locale
        ),
        minimum: formatTokenAmountWithSymbol(
          { amount: notice.minimum, token: notice.token },
          locale
        ),
      })}
    </Notice>
  );
};
