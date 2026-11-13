import type { ReactElement, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
  getCampaignProgress,
  getCampaignRateComposition,
} from "../../../domain/earn/campaign";
import type { EarnYieldWithProvider } from "../../../domain/earn/yield-schema";
import {
  formatPercent,
  formatRewardRatePercent,
  unavailableFigure,
} from "../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../shared/react/widget-presentation";
import {
  Avatar,
  Badge,
  Button,
  ExternalLink,
  DetailList,
  DetailRow,
  Meter,
  Metric,
  MetricGroup,
  Modal,
  Notice,
  Stack,
  Text,
} from "../../../ui/index";
import { formatRatePartLabel } from "../../yield-presentation/index";
import {
  formatCampaignDate,
  formatRateType,
  getCampaignDialogNotice,
  getCampaignName,
  getCampaignPaymentSentence,
  getCampaignPayoutCaption,
  getCampaignRateCaption,
  getCampaignStatus,
} from "../model/campaign-copy";
import { getCampaignAboutModel } from "../model/campaign-details-copy";
import type { YieldCampaignView } from "../model/yield-campaign-view";

const Section = ({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) => (
  <Stack gap={8}>
    <Text variant="heading" as="h3">
      {title}
    </Text>
    {children}
  </Stack>
);

/**
 * Everything about a campaign: its schedule, its rate and how it pays.
 * Opened by `trigger`, or by its owner through `open`.
 */
export const CampaignDetailsDialog = ({
  view,
  yieldDto,
  open,
  onOpenChange,
  trigger,
}: {
  readonly view: YieldCampaignView;
  readonly yieldDto: EarnYieldWithProvider;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly trigger?: ReactElement;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const { campaign, lifecycle, timeZone } = view;
  const progress = getCampaignProgress(campaign, view.now);
  const status = getCampaignStatus(lifecycle, t);
  const notice = getCampaignDialogNotice(view, t, locale);
  const rates = getCampaignRateComposition(yieldDto.rewardRate, view);
  const payoutCaption = getCampaignPayoutCaption(view, t, locale);
  const totalRateType = formatRateType(rates.total.rateType);
  const about = getCampaignAboutModel(view, yieldDto, t, locale);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      title={getCampaignName(view, yieldDto)}
      titleStatus={<Badge tone={status.tone}>{status.label}</Badge>}
      closeLabel={t("shared.close")}
      testId="campaign-details"
      footer={
        <Button
          variant="primary"
          size="cta"
          onClick={() => onOpenChange(false)}
        >
          {t("campaign.details.got_it")}
        </Button>
      }
    >
      <Stack gap={20}>
        {about?.sponsor ? (
          <Stack
            direction="row"
            align="center"
            gap={8}
            testId="campaign-details__sponsor"
          >
            <Avatar
              src={about.sponsor.logoURI ?? undefined}
              fallback={about.sponsor.name}
              size="xs"
            />
            <Text tone="muted">{about.sponsor.fundedBy}</Text>
          </Stack>
        ) : null}

        {notice ? (
          <Notice tone={notice.tone} title={notice.title}>
            {notice.body}
          </Notice>
        ) : null}

        {about ? (
          <Section title={t("campaign.details.about")}>
            {about.sponsor ? (
              <Text tone="muted">{about.sponsor.text}</Text>
            ) : null}
            {about.termsUrl ? (
              <Stack direction="row">
                <ExternalLink
                  href={about.termsUrl}
                  newTabLabel={t("shared.opens_in_new_tab")}
                >
                  {t("campaign.details.terms")}
                </ExternalLink>
              </Stack>
            ) : null}
          </Section>
        ) : null}

        <Section title={t("campaign.details.timeline")}>
          <MetricGroup columns={2} framed>
            <Metric
              label={t("campaign.details.start")}
              value={formatCampaignDate(campaign.startTime, timeZone, locale)}
              testId="campaign-details__start"
            />
            <Metric
              label={t("campaign.details.end")}
              value={formatCampaignDate(campaign.endTime, timeZone, locale)}
              valueTone={lifecycle === "ending_soon" ? "warning" : "default"}
            />
          </MetricGroup>
          <Meter
            label={t("campaign.details.progress")}
            value={progress * 100}
            valueText={formatPercent(progress, locale)}
            tone={lifecycle === "ending_soon" ? "warning" : "accent"}
          />
          <DetailList>
            {campaign.payoutFrequency ? (
              <DetailRow
                label={t("campaign.details.payouts")}
                value={t(`campaign.frequency.${campaign.payoutFrequency}`)}
                caption={payoutCaption}
              />
            ) : null}
          </DetailList>
        </Section>

        <Section title={t("campaign.details.rewards")}>
          <MetricGroup columns={rates.protocolIncentive ? 4 : 3} framed>
            <Metric
              label={formatRatePartLabel("native", rates.native.rateType, t)}
              value={formatRewardRatePercent(rates.native.rate, locale)}
            />
            {rates.protocolIncentive ? (
              <Metric
                label={formatRatePartLabel(
                  "protocol_incentive",
                  rates.protocolIncentive.rateType,
                  t
                )}
                value={formatRewardRatePercent(
                  rates.protocolIncentive.rate,
                  locale
                )}
              />
            ) : null}
            <Metric
              label={formatRatePartLabel(
                "campaign",
                rates.campaign?.rateType ?? campaign.rewardRate?.rateType,
                t
              )}
              value={
                rates.campaign
                  ? `+${formatRewardRatePercent(rates.campaign.rate, locale)}`
                  : unavailableFigure
              }
              caption={getCampaignRateCaption(view, t, locale)}
              testId="campaign-details__rate"
            />
            <Metric
              label={t("campaign.details.total", { rateType: totalRateType })}
              value={formatRewardRatePercent(rates.withCampaign, locale)}
              {...(lifecycle === "upcoming"
                ? { caption: t("campaign.details.total_caption_upcoming") }
                : {})}
            />
          </MetricGroup>
        </Section>

        <Section title={t("campaign.details.payment")}>
          <Text tone="muted">{getCampaignPaymentSentence(view, t)}</Text>
          <DetailList>
            <DetailRow
              label={t("campaign.details.reward_token")}
              value={campaign.rewardToken.symbol}
              logo={{
                name: campaign.rewardToken.symbol,
                src: campaign.rewardToken.logoURI ?? undefined,
              }}
            />
          </DetailList>
        </Section>
      </Stack>
    </Modal>
  );
};
