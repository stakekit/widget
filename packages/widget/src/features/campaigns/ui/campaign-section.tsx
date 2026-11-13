import { useAtomValue } from "@effect/atom-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  getCampaignProgress,
  getCampaignRateComposition,
} from "../../../domain/earn/campaign";
import type { EarnYieldWithProvider } from "../../../domain/earn/yield-schema";
import { formatPercent } from "../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../shared/react/widget-presentation";
import {
  Badge,
  Button,
  DetailList,
  DetailRow,
  Disclosure,
  Meter,
  Notice,
  Stack,
  Text,
} from "../../../ui/index";
import {
  getCampaignName,
  getCampaignPayouts,
  getCampaignProgressScale,
  getCampaignSectionNotice,
  getCampaignStatus,
} from "../model/campaign-copy";
import { getCampaignAboutModel } from "../model/campaign-details-copy";
import { yieldCampaignAtom } from "../state/yield-campaign";
import { CampaignDetailsDialog } from "./campaign-details-dialog";
import { CampaignRateRows } from "./campaign-rate-rows";

/**
 * A yield's campaign among its details: its state, rates, schedule and
 * payouts, and the full details a press away.
 */
export const CampaignSection = ({
  yieldDto,
}: {
  readonly yieldDto: EarnYieldWithProvider;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const view = useAtomValue(yieldCampaignAtom(yieldDto.id));

  if (!view) return null;

  const { campaign, lifecycle } = view;
  const progress = getCampaignProgress(campaign, view.now);
  const status = getCampaignStatus(lifecycle, t);
  const notice = getCampaignSectionNotice(view, t, locale);
  const payouts = getCampaignPayouts(view, t);
  const sponsor = getCampaignAboutModel(view, yieldDto, t, locale)?.sponsor;

  return (
    <Disclosure title={t("campaign.section.title")} defaultOpen>
      <Stack gap={12} testId="campaign-section">
        <Stack gap={4}>
          <Stack direction="row" align="center" gap={8} wrap>
            <Text weight="medium">{getCampaignName(view, yieldDto)}</Text>
            <Badge tone={status.tone}>{status.label}</Badge>
          </Stack>
          {sponsor ? (
            <Text variant="caption" tone="muted">
              {sponsor.fundedBy}
            </Text>
          ) : null}
        </Stack>

        <CampaignRateRows
          view={view}
          composition={getCampaignRateComposition(yieldDto.rewardRate, view)}
        />

        <Meter
          label={t("campaign.details.progress")}
          value={progress * 100}
          valueText={formatPercent(progress, locale)}
          tone={lifecycle === "ending_soon" ? "warning" : "accent"}
          scale={getCampaignProgressScale(view, locale)}
        />

        {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

        <DetailList>
          {payouts ? (
            <DetailRow label={t("campaign.details.payouts")} value={payouts} />
          ) : null}
          <DetailRow
            label={t("campaign.details.reward_token")}
            value={campaign.rewardToken.symbol}
            logo={{
              name: campaign.rewardToken.symbol,
              src: campaign.rewardToken.logoURI ?? undefined,
            }}
          />
        </DetailList>

        <Stack direction="row">
          <CampaignDetailsDialog
            view={view}
            yieldDto={yieldDto}
            open={detailsOpen}
            onOpenChange={setDetailsOpen}
            trigger={
              <Button
                size="sm"
                variant="link"
                iconEnd="ChevronRightIcon"
                testId="campaign-section__details"
              >
                {t("campaign.view_details")}
              </Button>
            }
          />
        </Stack>
      </Stack>
    </Disclosure>
  );
};
