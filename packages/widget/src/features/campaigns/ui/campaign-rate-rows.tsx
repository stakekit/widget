import { useTranslation } from "react-i18next";

import type { RateComposition } from "../../../domain/earn/reward-rate";
import { formatRewardRatePercent } from "../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../shared/react/widget-presentation";
import { DetailList, DetailRow } from "../../../ui/index";
import { formatRatePartLabel } from "../../yield-presentation/index";
import { getCampaignRateSummary } from "../model/campaign-copy";
import type { YieldCampaignView } from "../model/yield-campaign-view";

/**
 * A yield's rate as its campaign stands: its own rate, what the campaign
 * adds, and their total (today's, before the campaign starts).
 */
export const CampaignRateRows = ({
  view,
  composition,
}: {
  readonly view: YieldCampaignView;
  readonly composition: RateComposition;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();

  return (
    <DetailList>
      <DetailRow
        label={formatRatePartLabel("native", composition.native.rateType, t)}
        value={formatRewardRatePercent(composition.native.rate, locale)}
      />
      {composition.protocolIncentive ? (
        <DetailRow
          label={formatRatePartLabel(
            "protocol_incentive",
            composition.protocolIncentive.rateType,
            t
          )}
          value={formatRewardRatePercent(
            composition.protocolIncentive.rate,
            locale
          )}
        />
      ) : null}
      <DetailRow
        label={t("campaign.tip.incentive")}
        value={getCampaignRateSummary(view, composition, t, locale)}
        testId="campaign-rates__campaign"
      />
      <DetailRow
        label={t(
          view.lifecycle === "upcoming"
            ? "campaign.tip.total_today"
            : "campaign.tip.total"
        )}
        value={formatRewardRatePercent(composition.total.rate, locale)}
        testId="campaign-rates__total"
      />
    </DetailList>
  );
};
