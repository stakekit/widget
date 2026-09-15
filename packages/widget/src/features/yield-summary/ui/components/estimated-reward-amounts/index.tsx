import clsx from "clsx";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../../features/widget-configuration/index";
import { combineRecipeWithVariant } from "../../../../../shared/styles/recipe-variant";
import { VerticalDivider } from "../../../../../shared/ui/components/divider";
import { Box } from "../../../../../shared/ui/primitives/box";
import { ContentLoaderLine } from "../../../../../shared/ui/primitives/content-loader";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { selectYieldRewardsText } from "./styles.css";

type EstimatedRewardAmountsProps =
  | {
      loading: true;
      earnYearly?: ReactNode;
      earnMonthly?: ReactNode;
    }
  | {
      loading?: false;
      earnYearly: ReactNode;
      earnMonthly: ReactNode;
    };

export const EstimatedRewardAmounts = (props: EstimatedRewardAmountsProps) => {
  const dashboardVariant = useWidgetConfig("dashboardVariant");
  const variant = useWidgetConfig("variant");

  if (dashboardVariant || variant === "utila" || variant === "porto") {
    return <CompactEarnYearlyOrMonthly {...props} />;
  }

  return <DefaultEarnYearlyOrMonthly {...props} />;
};

const DefaultEarnYearlyOrMonthly = (props: EstimatedRewardAmountsProps) => {
  const { earnMonthly, earnYearly, loading = false } = props;
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
        {loading ? (
          <ContentLoaderLine widthPx="7ch" />
        ) : (
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
        )}
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
        {loading ? (
          <ContentLoaderLine widthPx="7ch" />
        ) : (
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
        )}
      </Box>
    </>
  );
};

const CompactEarnYearlyOrMonthly = (props: EstimatedRewardAmountsProps) => {
  const { earnMonthly, earnYearly, loading = false } = props;
  const { t } = useTranslation();

  if (loading) {
    return (
      <Box display="flex" alignItems="center" gap="3" flexWrap="wrap">
        <Box display="flex" alignItems="center">
          <ContentLoaderLine widthPx="12ch" />
        </Box>

        <VerticalDivider />

        <Box display="flex" alignItems="center">
          <ContentLoaderLine widthPx="13ch" />
        </Box>
      </Box>
    );
  }

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
