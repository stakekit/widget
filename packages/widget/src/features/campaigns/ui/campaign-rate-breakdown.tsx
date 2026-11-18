import { useAtomValue } from "@effect/atom-react";
import { useTranslation } from "react-i18next";

import {
  getRateComposition,
  type YieldRewardRate,
} from "../../../domain/earn/reward-rate";
import type { EarnYieldWithProvider } from "../../../domain/earn/yield-schema";
import { useWidgetPresentation } from "../../../shared/react/widget-presentation";
import { RewardRateBreakdown } from "../../yield-summary/views";
import { getCampaignCompositionValue } from "../model/campaign-copy";
import { yieldCampaignAtom } from "../state/yield-campaign";

/**
 * A rate's composition. With a campaign, its row reads as the campaign
 * stands ("Up to 4.2%", "Paused", or the planned rate before it starts).
 */
export const CampaignRateBreakdown = ({
  rewardRate,
  yieldDto,
  title,
  testId,
}: {
  /**
   * The rate to split without a campaign: the yield's, or its selected
   * validators'. A campaign's rate is the yield's, which alone carries its part.
   */
  readonly rewardRate: YieldRewardRate;
  readonly yieldDto: EarnYieldWithProvider;
  readonly title: string;
  readonly testId: string;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const view = useAtomValue(yieldCampaignAtom(yieldDto.id));

  if (!view) {
    return (
      <RewardRateBreakdown
        composition={getRateComposition(rewardRate, null)}
        title={title}
        testId={testId}
      />
    );
  }

  const composition = getRateComposition(yieldDto.rewardRate, view);

  return (
    <RewardRateBreakdown
      composition={composition}
      // The yield's campaign part under its shown Campaign is a ceiling;
      // without one shown, the breakdown above reads it plain.
      campaignUpTo
      title={title}
      testId={testId}
      campaign={{
        value: getCampaignCompositionValue(view, composition, t, locale),
        rateType: view.campaign.rewardRate?.rateType ?? null,
        // Before the start, the total is the yield's own rate today.
        ...(view.lifecycle === "upcoming"
          ? { totalLabel: t("campaign.tip.total_today") }
          : {}),
      }}
    />
  );
};
