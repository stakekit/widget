import { useAtomValue } from "@effect/atom-react";
import { type ComponentProps, useState } from "react";
import { useTranslation } from "react-i18next";

import type { EarnYieldWithProvider } from "../../../domain/earn/yield-schema";
import { formatRewardRatePercent } from "../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../shared/react/widget-presentation";
import { DetailList, DetailRow, Stack, Text } from "../../../ui/index";
import { RewardRateBreakdown } from "../../yield-summary/views";
import {
  getCampaignRateSummary,
  getCampaignCompositionValue,
  getCampaignName,
  getCampaignRates,
  getCampaignScheduleLine,
} from "../model/campaign-copy";
import { getCampaignCeilingModel } from "../model/campaign-details-copy";
import type { YieldCampaignView } from "../model/yield-campaign-view";
import { yieldCampaignAtom } from "../state/yield-campaign";
import { CampaignDetailsDialog } from "./campaign-details-dialog";

/** The campaign at a glance, beside its row of the rate's composition. */
const CampaignRateSummary = ({
  view,
  yieldDto,
}: {
  readonly view: YieldCampaignView;
  readonly yieldDto: EarnYieldWithProvider;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const rates = getCampaignRates(view, yieldDto);
  const capExplanation =
    getCampaignCeilingModel(view, yieldDto, t, locale)?.explanation ?? null;

  return (
    <Stack gap={8}>
      <Text variant="caption" weight="medium">
        {getCampaignName(view, yieldDto)}
      </Text>
      <DetailList>
        <DetailRow
          label={t(
            "details.apy_composition.native",
            rates.nativeRateType?.toLowerCase() === "apr"
              ? { context: "apr" }
              : {}
          )}
          value={formatRewardRatePercent(rates.native, locale)}
        />
        <DetailRow
          label={t("campaign.tip.incentive")}
          value={getCampaignRateSummary(view, yieldDto, t, locale)}
        />
        <DetailRow
          label={t(
            view.lifecycle === "upcoming"
              ? "campaign.tip.total_today"
              : "campaign.tip.total"
          )}
          value={formatRewardRatePercent(
            view.lifecycle === "upcoming" ? rates.native : rates.total,
            locale
          )}
        />
      </DetailList>
      {capExplanation ? (
        <Text variant="caption" tone="muted">
          {capExplanation}
        </Text>
      ) : null}
      <Text variant="caption" tone="muted">
        {getCampaignScheduleLine(view, t, locale)}
      </Text>
    </Stack>
  );
};

/**
 * A yield's rate composition. With a campaign, its row reads as the campaign
 * stands ("Up to 4.2%", "Paused", or the planned rate before it starts) and
 * explains the campaign beside its label, with its details a press away.
 */
export const CampaignRateBreakdown = ({
  yieldDto,
  ...breakdown
}: Omit<ComponentProps<typeof RewardRateBreakdown>, "campaign"> & {
  readonly yieldDto: EarnYieldWithProvider;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const view = useAtomValue(yieldCampaignAtom(yieldDto.id));

  if (!view) return <RewardRateBreakdown {...breakdown} />;

  return (
    <>
      <RewardRateBreakdown
        {...breakdown}
        campaign={{
          value: getCampaignCompositionValue(view, yieldDto, t, locale),
          rateType: getCampaignRates(view, yieldDto).campaignRateType,
          info: {
            label: t("campaign.tip.label"),
            text: <CampaignRateSummary view={view} yieldDto={yieldDto} />,
            action: {
              label: t("campaign.view_details"),
              onClick: () => setDetailsOpen(true),
            },
          },
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
