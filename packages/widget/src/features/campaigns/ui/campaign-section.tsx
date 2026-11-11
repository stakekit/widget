import { useAtomValue } from "@effect/atom-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { getCampaignTimeline } from "../../../domain/earn/campaign";
import type { EarnYieldWithProvider } from "../../../domain/earn/yield-schema";
import {
  formatPercent,
  formatTokenAmountWithSymbol,
} from "../../../shared/lib/number-format";
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
import {
  getCampaignAboutModel,
  getCampaignCeilingModel,
} from "../model/campaign-details-copy";
import { yieldCampaignAtom } from "../state/yield-campaign";
import { CampaignDetailsDialog } from "./campaign-details-dialog";

/**
 * A yield's campaign among its details: its state, schedule, payouts and
 * rules, and the full details a press away.
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
  const timeline = getCampaignTimeline(campaign, view.now);
  const status = getCampaignStatus(lifecycle, t);
  const notice = getCampaignSectionNotice(view, t, locale);
  const payouts = getCampaignPayouts(view, t);
  const qualification = campaign.qualificationConfig;
  const walletCap = qualification?.maxIncentivizedTvlToken;
  const sponsor = getCampaignAboutModel(view, yieldDto, t, locale)?.sponsor;
  const steppedDown = getCampaignCeilingModel(
    view,
    yieldDto,
    t,
    locale
  )?.steppedDown;

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

        <Meter
          label={t("campaign.details.progress")}
          value={timeline.elapsed * 100}
          valueText={formatPercent(timeline.elapsed, locale)}
          tone={lifecycle === "ending_soon" ? "warning" : "accent"}
          scale={getCampaignProgressScale(view, t)}
        />

        {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
        {steppedDown ? (
          <Notice tone="info" testId="campaign-section__stepped-down">
            {steppedDown.summary}
          </Notice>
        ) : null}

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
          {qualification ? (
            <DetailRow
              label={t("campaign.details.minimum")}
              value={formatTokenAmountWithSymbol(
                { amount: qualification.threshold, token: yieldDto.token },
                locale
              )}
            />
          ) : null}
          {walletCap ? (
            <DetailRow
              label={t("campaign.details.maximum")}
              value={formatTokenAmountWithSymbol(
                { amount: walletCap, token: yieldDto.token },
                locale
              )}
            />
          ) : null}
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
