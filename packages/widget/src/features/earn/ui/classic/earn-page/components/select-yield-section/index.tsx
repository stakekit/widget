import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../../../../features/widget-configuration/index";
import { combineRecipeWithVariant } from "../../../../../../../shared/styles/recipe-variant";
import { Divider } from "../../../../../../../shared/ui/components/divider";
import { Box } from "../../../../../../../shared/ui/primitives/box";
import { ContentLoaderLine } from "../../../../../../../shared/ui/primitives/content-loader";
import { Text } from "../../../../../../../shared/ui/primitives/typography/text";
import { YieldRiskRatingSummary } from "../../../../../../yield-summary/views";
import {
  useEarnEntry,
  useEarnYieldSelection,
} from "../../../../../react/use-earn-facades";
import { apyYield } from "../../styles.css";
import {
  SelectOpportunity,
  SelectOpportunityTrigger,
} from "./select-opportunity";
import {
  SelectYieldRewardDetails,
  SelectYieldRewardDetailsSkeleton,
} from "./select-yield-reward-details";
import { selectYieldSection } from "./styles.css";
import { useAnimateYieldPercent } from "./use-animated-yield-percent-boundary";

export const SelectYieldSection = () => {
  const { view: entry } = useEarnEntry();
  const { view: yieldSelection } = useEarnYieldSelection();

  const { t } = useTranslation();

  const isLoading = entry.appLoading || yieldSelection.isLoading;

  const yieldPerc = useAnimateYieldPercent(entry.estimatedRewards);
  const riskSummary = entry.selectedStake ? (
    <YieldRiskRatingSummary yieldDto={entry.selectedStake} />
  ) : null;
  const opportunityCount = yieldSelection.all.length;

  if (isLoading) {
    return <SelectYieldSectionSkeleton />;
  }

  if (opportunityCount === 0) {
    return (
      <Box my="4" display="flex" justifyContent="center" alignItems="center">
        <Text>{t("details.no_opportunities")}</Text>
      </Box>
    );
  }

  return (
    <SelectYieldSectionLayout
      rewardPercent={<motion.span>{yieldPerc}</motion.span>}
      opportunity={<SelectOpportunity />}
      rewardDetails={<SelectYieldRewardDetails />}
      riskSummary={riskSummary}
    />
  );
};

export const SelectYieldSectionSkeleton = () => (
  <SelectYieldSectionLayout
    rewardPercent={<ContentLoaderLine widthPx="5ch" />}
    opportunity={<SelectOpportunityTrigger />}
    rewardDetails={<SelectYieldRewardDetailsSkeleton />}
  />
);

const SelectYieldSectionLayout = ({
  rewardPercent,
  opportunity,
  rewardDetails,
  riskSummary,
}: {
  rewardPercent: ReactNode;
  opportunity: ReactNode;
  rewardDetails: ReactNode;
  riskSummary?: ReactNode;
}) => {
  const { t } = useTranslation();
  const dashboardVariant = useWidgetConfig("dashboardVariant");
  const variant = useWidgetConfig("variant");
  const showSectionTitle =
    !dashboardVariant &&
    variant !== "zerion" &&
    variant !== "utila" &&
    variant !== "porto";

  return (
    <Box>
      {showSectionTitle && (
        <Box my="2">
          <Text>{t("details.earn")}</Text>
        </Box>
      )}

      <Box
        data-rk="stake-yield-section"
        background="stakeSectionBackground"
        borderRadius="xl"
        marginTop="2"
        py="4"
        px="4"
        className={combineRecipeWithVariant({
          rec: selectYieldSection,
          variant,
        })}
      >
        {variant === "zerion" && (
          <Box my="1">
            <Text>{t("details.earn")}</Text>
          </Box>
        )}
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box minWidth="0" display="flex" marginRight="2" flex={1}>
            <Box position="relative" data-testid="estimated-reward__percent">
              <Box as="p" className={apyYield}>
                {rewardPercent}
              </Box>
            </Box>
          </Box>

          <Box display="flex" justifyContent="center" alignItems="center">
            {opportunity}
          </Box>
        </Box>

        {variant !== "zerion" && rewardDetails}
      </Box>

      {variant !== "zerion" && !dashboardVariant && riskSummary}

      {variant === "zerion" && (
        <Box display="flex" flexDirection="column" gap="3">
          {rewardDetails}

          {!dashboardVariant && riskSummary}

          <Divider />
        </Box>
      )}
    </Box>
  );
};
