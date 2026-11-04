import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../../features/widget-configuration/index";
import { Divider, Stack, Text } from "../../../../../ui/index";

type EstimatedRewardAmountsProps = {
  earnYearly: string;
  earnMonthly: string;
};

export const EstimatedRewardAmounts = ({
  earnYearly,
  earnMonthly,
}: EstimatedRewardAmountsProps) => {
  const { t } = useTranslation();
  const { earnPresentation } = useWidgetConfig("hostProfile");

  if (earnPresentation.condensed) {
    return (
      <Stack direction="row" align="center" gap={12} wrap>
        <Stack direction="row" gap={8}>
          <Text>{t("shared.yearly")}</Text>
          <Text numeric>{earnYearly}</Text>
        </Stack>

        <Divider orientation="vertical" />

        <Stack direction="row" gap={8}>
          <Text>{t("shared.monthly")}</Text>
          <Text numeric>{earnMonthly}</Text>
        </Stack>
      </Stack>
    );
  }

  return (
    <Stack gap={8}>
      <Stack
        direction="row"
        align="center"
        justify="between"
        gap={8}
        testId="estimated-reward__yearly"
        hostHook="estimated-reward__yearly"
      >
        <Text tone="muted">
          {t(
            earnPresentation.zerion ? "details.rewards.yearly" : "shared.yearly"
          )}
        </Text>
        <Text tone="muted" numeric>
          {earnYearly}
        </Text>
      </Stack>

      <Stack
        direction="row"
        align="center"
        justify="between"
        gap={8}
        testId="estimated-reward__monthly"
        hostHook="estimated-reward__monthly"
      >
        <Text tone="muted">{t("shared.monthly")}</Text>
        <Text tone="muted" numeric>
          {earnMonthly}
        </Text>
      </Stack>
    </Stack>
  );
};
