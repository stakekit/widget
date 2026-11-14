import { useAtomSubscribe, useAtomValue } from "@effect/atom-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { getCampaignProgress } from "../../../domain/earn/campaign";
import { getRateComposition } from "../../../domain/earn/reward-rate";
import type { EarnYieldWithProvider } from "../../../domain/earn/yield-schema";
import { formatPercent } from "../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../shared/react/widget-presentation";
import {
  DetailList,
  DetailRow,
  Disclosure,
  ExternalLink,
  Meter,
  Notice,
  Stack,
  Text,
} from "../../../ui/index";
import {
  getCampaignName,
  getCampaignPayoutCaption,
  getCampaignPayouts,
  getCampaignProgressScale,
  getCampaignSectionNotice,
} from "../model/campaign-copy";
import { getCampaignAboutModel } from "../model/campaign-details-copy";
import { campaignDetailsRequestAtom } from "../state/campaign-details-request";
import { yieldCampaignAtom } from "../state/yield-campaign";
import { CampaignRateRows } from "./campaign-rate-rows";

/**
 * A yield's campaign details: who funds it, its rates, schedule and payouts.
 * It opens and comes into view when its strip or rate tip asks for them.
 */
export const CampaignSection = ({
  yieldDto,
  defaultOpen = true,
}: {
  readonly yieldDto: EarnYieldWithProvider;
  readonly defaultOpen?: boolean;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const [revealKey, setRevealKey] = useState(0);
  const view = useAtomValue(yieldCampaignAtom(yieldDto.id));

  useAtomSubscribe(campaignDetailsRequestAtom, (request) => {
    if (request?.yieldId === yieldDto.id) setRevealKey(request.count);
  });

  if (!view) return null;

  const { campaign, lifecycle } = view;
  const progress = getCampaignProgress(campaign, view.now);
  const notice = getCampaignSectionNotice(view, t, locale);
  const about = getCampaignAboutModel(view, t);

  return (
    <Disclosure
      title={t("campaign.section.title")}
      defaultOpen={defaultOpen}
      revealKey={revealKey}
      testId="campaign-section__toggle"
    >
      <Stack gap={12} testId="campaign-section">
        <Stack gap={4}>
          <Text weight="medium">{getCampaignName(view, yieldDto)}</Text>
          {about?.sponsor ? (
            <Text variant="caption" tone="muted">
              {about.sponsor}
            </Text>
          ) : null}
          {about?.termsUrl ? (
            <Stack direction="row">
              <ExternalLink
                href={about.termsUrl}
                newTabLabel={t("shared.opens_in_new_tab")}
              >
                {t("campaign.details.terms")}
              </ExternalLink>
            </Stack>
          ) : null}
        </Stack>

        <CampaignRateRows
          view={view}
          composition={getRateComposition(yieldDto.rewardRate, view)}
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
          <DetailRow
            label={t("campaign.details.payouts")}
            value={getCampaignPayouts(view, t)}
            caption={getCampaignPayoutCaption(view, t, locale)}
          />
          <DetailRow
            label={t("campaign.details.reward_token")}
            value={campaign.rewardToken.symbol}
            logo={{
              name: campaign.rewardToken.symbol,
              src: campaign.rewardToken.logoURI ?? undefined,
            }}
          />
        </DetailList>
      </Stack>
    </Disclosure>
  );
};
