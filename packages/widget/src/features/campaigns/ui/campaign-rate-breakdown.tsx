import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useTranslation } from "react-i18next";

import {
  getRateComposition,
  type YieldRewardRate,
} from "../../../domain/earn/reward-rate";
import type { EarnYieldWithProvider } from "../../../domain/earn/yield-schema";
import { useWidgetPresentation } from "../../../shared/react/widget-presentation";
import { RewardRateBreakdown } from "../../yield-summary/views";
import { getCampaignCompositionValue } from "../model/campaign-copy";
import { requestCampaignDetailsAtom } from "../state/campaign-details-request";
import { yieldCampaignAtom } from "../state/yield-campaign";
import { CampaignRateRows } from "./campaign-rate-rows";

/**
 * A rate's composition. With a campaign, its row reads as the campaign
 * stands ("Up to 4.2%", "Paused", or the planned rate before it starts) and
 * explains the campaign beside its label, linking to its Campaign section.
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
  const requestDetails = useAtomSet(requestCampaignDetailsAtom);
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
        info: {
          label: t("campaign.tip.label"),
          text: <CampaignRateRows view={view} composition={composition} />,
          action: {
            label: t("campaign.view_details"),
            onClick: () => requestDetails(yieldDto.id),
          },
        },
        // Before the start, the total is the yield's own rate today.
        ...(view.lifecycle === "upcoming"
          ? { totalLabel: t("campaign.tip.total_today") }
          : {}),
      }}
    />
  );
};
