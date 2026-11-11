import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";

import {
  getRewardRateBreakdown,
  type RewardRateBreakdownItem,
  type YieldRewardRate,
} from "../../../../../domain/earn/reward-rate";
import { formatRewardRatePercent } from "../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import { DetailList, DetailRow, Stack, Text } from "../../../../../ui/index";

const getLabelKey = (key: RewardRateBreakdownItem["key"]) => {
  switch (key) {
    case "native":
      return "details.apy_composition.native";
    case "protocol_incentive":
      return "details.apy_composition.protocol_incentive";
    case "campaign":
      return "details.apy_composition.campaign";
  }
};

/**
 * The campaign's row, as its owner words it: such as "Paused" or a planned
 * rate before the campaign is part of the yield's rate, with a summary of
 * the campaign beside its label.
 */
export type RewardRateCampaignRow = {
  readonly value: string;
  readonly rateType: string | null;
  readonly info?: ComponentProps<typeof DetailRow>["info"];
};

/**
 * The rows a breakdown shows: the rate's own parts, with the campaign's row
 * worded by `campaign` and added when the rate holds no campaign part yet.
 */
const getRows = (
  rewardRate: YieldRewardRate | null | undefined,
  showUpToCampaign: boolean,
  campaign: RewardRateCampaignRow | undefined
): ReadonlyArray<RewardRateBreakdownItem> => {
  const items = getRewardRateBreakdown(rewardRate, { showUpToCampaign });
  if (!campaign || !rewardRate) return items;

  const ownParts = items.filter((item) => item.key !== "campaign");
  const parts: ReadonlyArray<RewardRateBreakdownItem> = ownParts.length
    ? ownParts
    : [
        {
          key: "native",
          rate: rewardRate.total,
          rewardType: rewardRate.rateType,
          isUpTo: false,
        },
      ];
  const campaignItem: RewardRateBreakdownItem = {
    key: "campaign",
    rate: rewardRate.total,
    rewardType: campaign.rateType ?? undefined,
    isUpTo: false,
  };

  return [...parts, campaignItem];
};

export const RewardRateBreakdown = ({
  rewardRate,
  showUpToCampaign = false,
  campaign,
  title,
  testId,
}: {
  rewardRate: YieldRewardRate | null | undefined;
  showUpToCampaign?: boolean;
  /** The yield's campaign, whose row it words; see `RewardRateCampaignRow`. */
  campaign?: RewardRateCampaignRow | undefined;
  title?: string;
  testId?: string;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();

  const items = getRows(rewardRate, showUpToCampaign, campaign);

  if (items.length < 2) {
    return null;
  }

  const getValue = (item: RewardRateBreakdownItem) => {
    if (item.key === "campaign" && campaign) return campaign.value;
    const value = formatRewardRatePercent(item.rate, locale);
    return item.isUpTo ? t("details.apy_composition.up_to", { value }) : value;
  };

  return (
    <Stack gap={8} {...(testId ? { testId } : {})}>
      {title ? <Text tone="muted">{title}</Text> : null}

      <DetailList>
        {items.map((item) => (
          <DetailRow
            key={item.key}
            // A campaign incentive is an APR even inside an APY yield.
            label={t(
              getLabelKey(item.key),
              item.rewardType?.toLowerCase() === "apr" ? { context: "apr" } : {}
            )}
            value={getValue(item)}
            {...(item.key === "campaign" && campaign?.info
              ? { info: campaign.info }
              : {})}
            {...(testId
              ? { testId: `${testId}__${item.key.replaceAll("_", "-")}` }
              : {})}
          />
        ))}
      </DetailList>
    </Stack>
  );
};
