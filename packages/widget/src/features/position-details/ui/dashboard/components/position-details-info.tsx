import { useTranslation } from "react-i18next";
import { Box } from "../../../../../shared/ui/primitives/box";
import { ContentLoaderSquare } from "../../../../../shared/ui/primitives/content-loader";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import {
  AddressRow,
  DetailRow,
  DetailsSection,
} from "../../../../earn/ui/dashboard/earn-details/components/details-section";
import { EarnDetailsHeader } from "../../../../earn/ui/dashboard/earn-details/components/earn-details-header";
import {
  CurrentRewardsSummaryKey,
  currentRewardsSummaryAtom,
} from "../../../../yield-summary/yield-insights";
import { usePositionDetails } from "../../classic/hooks/use-position-details";
import {
  type DashboardPositionMetricCard,
  getDashboardPositionDetailsModel,
  getPositionHeaderBadges,
} from "../position-details-model";
import * as styles from "./styles.css";

const PositionMetricCards = ({
  cards,
}: {
  cards: DashboardPositionMetricCard[];
}) => (
  <Box className={styles.metricGrid}>
    {cards.map((card) => {
      const tone = card.tone ?? "default";

      return (
        <Box
          className={styles.metricCard({ tone })}
          display="flex"
          flexDirection="column"
          gap="1"
          key={card.id}
        >
          <Text
            className={styles.metricLabelText}
            variant={{ type: "muted", weight: "normal" }}
          >
            {card.label}
          </Text>

          {typeof card.value === "string" ? (
            <Text
              className={styles.metricValueText({ tone })}
              variant={{ weight: "bold" }}
            >
              {card.value}
            </Text>
          ) : (
            <Box>{card.value}</Box>
          )}

          {card.subValue && (
            <Text
              className={styles.metricSubValueText}
              variant={{ type: "muted", weight: "normal" }}
            >
              {card.subValue}
            </Text>
          )}
        </Box>
      );
    })}
  </Box>
);

export const PositionDetailsInfo = () => {
  const positionDetails = usePositionDetails();
  const { t } = useTranslation();

  const rewardsYieldId = positionDetails.integrationData?.id ?? null;
  const rewardsSummaries = AsyncResult.getOrElse(
    useAtomValue(
      currentRewardsSummaryAtom(
        new CurrentRewardsSummaryKey({
          yieldIds: rewardsYieldId ? [rewardsYieldId] : [],
        })
      )
    ),
    () => null
  );

  if (positionDetails.isLoading) {
    return <ContentLoaderSquare heightPx={430} />;
  }

  const integrationData = positionDetails.integrationData;
  const positionBalancesByType = positionDetails.positionBalancesByType;
  if (integrationData && positionBalancesByType) {
    const model = getDashboardPositionDetailsModel({
      canUnstake: positionDetails.canUnstake,
      integrationData,
      pendingActions: positionDetails.pendingActions ?? [],
      personalizedRewardRate: positionDetails.personalizedRewardRate,
      positionBalancesByType,
      providersDetails: positionDetails.providersDetails ?? [],
      reducedStakedOrLiquidBalance:
        positionDetails.reducedStakedOrLiquidBalance,
      rewardsSummary: rewardsYieldId
        ? (rewardsSummaries?.[rewardsYieldId] ?? undefined)
        : undefined,
      t,
    });

    return (
      <Box
        className={styles.infoContainer}
        display="flex"
        flexDirection="column"
        gap="4"
      >
        <EarnDetailsHeader
          headerBadges={getPositionHeaderBadges(integrationData, t)}
          providerName={model.providerName}
          yieldDto={integrationData}
        />

        <PositionMetricCards cards={model.metricCards} />

        {model.breakdownRows.length > 0 && (
          <DetailsSection title={t("dashboard.position_details.breakdown")}>
            <Box display="flex" flexDirection="column">
              {model.breakdownRows.map((row) => (
                <Box className={styles.breakdownRow} key={row.id}>
                  <Text variant={{ type: "muted", weight: "normal" }}>
                    {row.label}
                  </Text>

                  <Box className={styles.breakdownAmounts}>
                    <Text className={styles.breakdownValue}>{row.value}</Text>
                    {row.subValue && (
                      <Text
                        className={styles.breakdownSubValue}
                        variant={{ type: "muted", weight: "normal" }}
                      >
                        {row.subValue}
                      </Text>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          </DetailsSection>
        )}

        <DetailsSection title={t("dashboard.position_details.details")}>
          {model.detailRows.map((row) => (
            <DetailRow key={row.id} {...row} />
          ))}

          {model.addressRows.length > 0 && (
            <Box display="flex" flexDirection="column" gap="2" marginTop="2">
              {model.addressRows.map((row) => (
                <AddressRow key={`${row.label}-${row.address}`} {...row} />
              ))}
            </Box>
          )}
        </DetailsSection>
      </Box>
    );
  }

  return (
    <Box
      alignItems="center"
      className={styles.infoContainer}
      display="flex"
      justifyContent="center"
    >
      <Text variant={{ type: "muted", weight: "normal" }}>
        {t("dashboard.position_details.empty")}
      </Text>
    </Box>
  );
};

import { useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
