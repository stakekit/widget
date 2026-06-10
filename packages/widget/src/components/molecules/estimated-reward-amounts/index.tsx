import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { selectYieldRewardsText } from "../../../pages/details/earn-page/components/select-yield-section/styles.css";
import { VerticalDivider } from "../../../pages-dashboard/common/components/divider";
import { useSettings } from "../../../providers/settings";
import { combineRecipeWithVariant } from "../../../utils/styles";
import { Box } from "../../atoms/box";
import { Text } from "../../atoms/typography/text";

type EstimatedRewardAmountsProps = {
  earnYearly: string;
  earnMonthly: string;
};

export const EstimatedRewardAmounts = ({
  earnYearly,
  earnMonthly,
}: EstimatedRewardAmountsProps) => {
  const { variant } = useSettings();

  if (variant === "utila" || variant === "porto") {
    return (
      <UtilaEarnYearlyOrMonthly
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
  const { variant } = useSettings();

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

const UtilaEarnYearlyOrMonthly = ({
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
