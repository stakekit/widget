import { useTranslation } from "react-i18next";
import {
  getRewardRateBreakdown,
  type RewardRateBreakdownItem,
} from "../../../domain/types/reward-rate";
import type { YieldRewardRateDto } from "../../../providers/yield-api-client-provider/types";
import { getRewardRateFormatted } from "../../../utils/formatters";
import { Box } from "../../atoms/box";
import { Text } from "../../atoms/typography/text";

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
  rewardRate: YieldRewardRateDto | null | undefined;
  showUpToCampaign?: boolean;
  title?: string;
  testId?: string;
}) => {
  const { t } = useTranslation();

  const items = getRewardRateBreakdown(rewardRate, {
    showUpToCampaign,
  });

  console.log({ items });

  if (!items.length) {
    return null;
  }

  return (
    <Box
      display="flex"
      flexDirection="column"
      gap="2"
      marginTop="3"
      data-testid={testId}
    >
      {title ? (
        <Text variant={{ type: "muted", weight: "normal" }}>{title}</Text>
      ) : null}

      {items.map((item) => {
        const value = getRewardRateFormatted({
          rewardRate: item.rate,
          rewardType: item.rewardType,
        });

        return (
          <Box
            key={item.key}
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            gap="3"
            data-testid={
              testId ? `${testId}__${item.key.replaceAll("_", "-")}` : undefined
            }
          >
            <Text variant={{ type: "muted", weight: "normal" }}>
              {t(getLabelKey(item.key))}
            </Text>

            <Text variant={{ type: "muted", weight: "normal" }}>
              {item.isUpTo
                ? t("details.apy_composition.up_to", { value })
                : value}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
};
