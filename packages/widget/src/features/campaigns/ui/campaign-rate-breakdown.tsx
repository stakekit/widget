import { useAtomValue } from "@effect/atom-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { getCampaignRateComposition } from "../../../domain/earn/campaign";
import {
  getRateComposition,
  type YieldRewardRate,
} from "../../../domain/earn/reward-rate";
import type { EarnYieldWithProvider } from "../../../domain/earn/yield-schema";
import { useWidgetPresentation } from "../../../shared/react/widget-presentation";
import { RewardRateBreakdown } from "../../yield-summary/views";
import { getCampaignCompositionValue } from "../model/campaign-copy";
import { yieldCampaignAtom } from "../state/yield-campaign";
import { CampaignDetailsDialog } from "./campaign-details-dialog";
import { CampaignRateRows } from "./campaign-rate-rows";

/**
 * A rate's composition. With a campaign, its row reads as the campaign
 * stands ("Up to 4.2%", "Paused", or the planned rate before it starts) and
 * explains the campaign beside its label, with its details a press away.
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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const view = useAtomValue(yieldCampaignAtom(yieldDto.id));

  if (!view) {
    return (
      <RewardRateBreakdown
        composition={getRateComposition(rewardRate)}
        title={title}
        testId={testId}
      />
    );
  }

  const composition = getCampaignRateComposition(yieldDto.rewardRate, view);

  return (
    <>
      <RewardRateBreakdown
        composition={composition}
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
              onClick: () => setDetailsOpen(true),
            },
          },
          // Before the start, the total is the yield's own rate today.
          ...(view.lifecycle === "upcoming"
            ? { totalLabel: t("campaign.tip.total_today") }
            : {}),
        }}
      />
      <CampaignDetailsDialog
        view={view}
        yieldDto={yieldDto}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </>
  );
};
