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

export const RewardRateBreakdown = ({
  rewardRate,
  showUpToCampaign = false,
  title,
  testId,
}: {
  rewardRate: YieldRewardRate | null | undefined;
  showUpToCampaign?: boolean;
  title?: string;
  testId?: string;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();

  const items = getRewardRateBreakdown(rewardRate, {
    showUpToCampaign,
  });

  if (items.length < 2) {
    return null;
  }

  return (
    <Stack gap={8} {...(testId ? { testId } : {})}>
      {title ? <Text tone="muted">{title}</Text> : null}

      <DetailList>
        {items.map((item) => {
          const value = formatRewardRatePercent(item.rate, locale);

          return (
            <DetailRow
              key={item.key}
              label={t(getLabelKey(item.key))}
              value={
                item.isUpTo
                  ? t("details.apy_composition.up_to", { value })
                  : value
              }
              {...(testId
                ? { testId: `${testId}__${item.key.replaceAll("_", "-")}` }
                : {})}
            />
          );
        })}
      </DetailList>
    </Stack>
  );
};
