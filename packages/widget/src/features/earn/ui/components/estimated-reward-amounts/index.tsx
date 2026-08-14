import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../../app/composition/use-widget-config";
import { combineRecipeWithVariant } from "../../../../../shared/styles/recipe-variant";
import { VerticalDivider } from "../../../../../shared/ui/components/divider";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { selectYieldRewardsText } from "../../classic/earn-page/components/select-yield-section/styles.css";

type EstimatedRewardAmountsProps = {
  earnYearly: string;
  earnMonthly: string;
};

export const EstimatedRewardAmounts = ({
  earnYearly,
  earnMonthly,
}: EstimatedRewardAmountsProps) => {
  const dashboardVariant = useWidgetConfig("dashboardVariant");
  const variant = useWidgetConfig("variant");

  if (dashboardVariant || variant === "utila" || variant === "porto") {
    return (
      <CompactEarnYearlyOrMonthly
        earnMonthly={earnMonthly}
        earnYearly={earnYearly}
      />
    );
  }

  return (
    <DefaultEarnYearlyOrMonthly
      earnMonthly={earnMonthly}
      earnYearly={earnYearly}
    />
  );
};

const DefaultEarnYearlyOrMonthly = ({
  earnMonthly,
  earnYearly,
}: EstimatedRewardAmountsProps) => {
  const { t } = useTranslation();
  const variant = useWidgetConfig("variant");

  return (
    <>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        data-testid="estimated-reward__yearly"
        data-rk="estimated-reward__yearly"
        gap="2"
      >
        <Text
          variant={{ type: "muted", weight: "normal" }}
          className={clsx(
            combineRecipeWithVariant({
              rec: selectYieldRewardsText,
              variant,
            })
          )}
        >
          {t(variant === "zerion" ? "details.rewards.yearly" : "shared.yearly")}
        </Text>
        <Text
          variant={{ type: "muted", weight: "normal" }}
          className={clsx(
            combineRecipeWithVariant({
              rec: selectYieldRewardsText,
              variant,
            })
          )}
        >
          {earnYearly}
        </Text>
      </Box>

      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        data-testid="estimated-reward__monthly"
        data-rk="estimated-reward__monthly"
        gap="2"
      >
        <Text
          variant={{ type: "muted", weight: "normal" }}
          className={clsx(
            combineRecipeWithVariant({
              rec: selectYieldRewardsText,
              variant,
            })
          )}
        >
          {t("shared.monthly")}
        </Text>
        <Text
          variant={{ type: "muted", weight: "normal" }}
          className={clsx(
            combineRecipeWithVariant({
              rec: selectYieldRewardsText,
              variant,
            })
          )}
        >
          {earnMonthly}
        </Text>
      </Box>
    </>
  );
};

const CompactEarnYearlyOrMonthly = ({
  earnMonthly,
  earnYearly,
}: EstimatedRewardAmountsProps) => {
  const { t } = useTranslation();

  return (
    <Box display="flex" alignItems="center" gap="3" flexWrap="wrap">
      <Box display="flex" alignItems="center" gap="2">
        <Text variant={{ weight: "normal" }}>{t("shared.yearly")}</Text>
        <Text variant={{ weight: "normal" }}>{earnYearly}</Text>
      </Box>

      <VerticalDivider />

      <Box display="flex" alignItems="center" gap="2">
        <Text variant={{ weight: "normal" }}>{t("shared.monthly")}</Text>
        <Text variant={{ weight: "normal" }}>{earnMonthly}</Text>
      </Box>
    </Box>
  );
};
