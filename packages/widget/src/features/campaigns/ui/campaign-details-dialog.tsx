import type { ReactElement, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { getCampaignTimeline } from "../../../domain/earn/campaign";
import type { EarnYieldWithProvider } from "../../../domain/earn/yield-schema";
import {
  formatPercent,
  formatRewardRatePercent,
  formatTokenAmountWithSymbol,
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
import {
  formatCampaignDate,
  formatRateType,
  getCampaignDialogNotice,
  getCampaignName,
  getCampaignPaymentSentence,
  getCampaignPayoutCaption,
  getCampaignProgressScale,
  getCampaignRateCaption,
  getCampaignRates,
  getCampaignStatus,
} from "../model/campaign-copy";
import {
  getCampaignAboutModel,
  getCampaignCeilingModel,
} from "../model/campaign-details-copy";
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
 * Everything about a campaign: its schedule, its rate, how it pays and who
 * earns it. Opened by `trigger`, or by its owner through `open`.
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
  const timeline = getCampaignTimeline(campaign, view.now);
  const status = getCampaignStatus(lifecycle, t);
  const notice = getCampaignDialogNotice(view, t, locale);
  const rates = getCampaignRates(view, yieldDto);
  const scale = getCampaignProgressScale(view, t);
  const payoutCaption = getCampaignPayoutCaption(view, t, locale);
  const qualification = campaign.qualificationConfig;
  const walletCap = qualification?.maxIncentivizedTvlToken;
  const yieldRateType = formatRateType(yieldDto.rewardRate.rateType);
  const about = getCampaignAboutModel(view, yieldDto, t, locale);
  const ceilingModel = getCampaignCeilingModel(view, yieldDto, t, locale);

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

        {ceilingModel?.steppedDown ? (
          <Notice
            tone="info"
            title={ceilingModel.steppedDown.title}
            testId="campaign-details__stepped-down"
          >
            {ceilingModel.steppedDown.text}
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
            value={timeline.elapsed * 100}
            valueText={formatPercent(timeline.elapsed, locale)}
            tone={lifecycle === "ending_soon" ? "warning" : "accent"}
            scale={scale}
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
          <MetricGroup columns={3} framed>
            <Metric
              label={t(
                "details.apy_composition.native",
                rates.nativeRateType?.toLowerCase() === "apr"
                  ? { context: "apr" }
                  : {}
              )}
              value={formatRewardRatePercent(rates.native, locale)}
            />
            <Metric
              label={t(
                "details.apy_composition.campaign",
                rates.campaignRateType?.toLowerCase() === "apr"
                  ? { context: "apr" }
                  : {}
              )}
              value={
                rates.campaign
                  ? `+${formatRewardRatePercent(rates.campaign, locale)}`
                  : unavailableFigure
              }
              caption={getCampaignRateCaption(view, t, locale)}
              testId="campaign-details__rate"
            />
            <Metric
              label={t("campaign.details.total", { rateType: yieldRateType })}
              value={formatRewardRatePercent(rates.total, locale)}
              {...(lifecycle === "upcoming"
                ? { caption: t("campaign.details.total_caption_upcoming") }
                : {})}
            />
          </MetricGroup>
          {ceilingModel ? (
            <Stack gap={8} testId="campaign-details__ceiling">
              <Text tone="muted">{ceilingModel.explanation}</Text>
              {ceilingModel.steps.length > 0 ? (
                <>
                  <Text weight="medium">{ceilingModel.label}</Text>
                  <DetailList>
                    {ceilingModel.steps.map((step) => (
                      <DetailRow
                        key={step.id}
                        label={step.label}
                        value={step.value}
                        valueStruck={step.struck}
                        tone={step.current ? "success" : "default"}
                        {...(step.current
                          ? { caption: t("campaign.details.ceiling.step_now") }
                          : {})}
                      />
                    ))}
                  </DetailList>
                  {ceilingModel.stepsNote ? (
                    <Text variant="caption" tone="muted">
                      {ceilingModel.stepsNote}
                    </Text>
                  ) : null}
                </>
              ) : (
                <DetailList>
                  <DetailRow
                    label={ceilingModel.label}
                    value={ceilingModel.ceiling}
                  />
                </DetailList>
              )}
            </Stack>
          ) : null}
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

        {qualification ? (
          <Section title={t("campaign.details.rules")}>
            <DetailList>
              <DetailRow
                label={t("campaign.details.minimum")}
                value={formatTokenAmountWithSymbol(
                  { amount: qualification.threshold, token: yieldDto.token },
                  locale
                )}
                testId="campaign-details__minimum"
              />
              {walletCap ? (
                <DetailRow
                  label={t("campaign.details.maximum")}
                  value={formatTokenAmountWithSymbol(
                    { amount: walletCap, token: yieldDto.token },
                    locale
                  )}
                  caption={t("campaign.details.maximum_caption")}
                  testId="campaign-details__maximum"
                />
              ) : null}
            </DetailList>
          </Section>
        ) : null}
      </Stack>
    </Modal>
  );
};
