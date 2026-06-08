import { useTranslation } from "react-i18next";
import { Box } from "../../../components/atoms/box";
import { ContentLoaderSquare } from "../../../components/atoms/content-loader";
import { Text } from "../../../components/atoms/typography/text";
import { useRewardsSummary } from "../../../hooks/use-rewards-summary";
import { usePositionDetails } from "../../../pages/position-details/hooks/use-position-details";
import {
  AddressRow,
  DetailRow,
  DetailsSection,
} from "../../overview/earn-details/components/details-section";
import { EarnDetailsHeader } from "../../overview/earn-details/components/earn-details-header";
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

  const rewardsSummaryQuery = useRewardsSummary(
    positionDetails.integrationData.mapOrDefault((yieldDto) => yieldDto.id, "")
  );

  if (positionDetails.isLoading) {
    return <ContentLoaderSquare heightPx={430} />;
  }

  return positionDetails.integrationData
    .chain((integrationData) =>
      positionDetails.positionBalancesByType.map((positionBalancesByType) => {
        const model = getDashboardPositionDetailsModel({
          canUnstake: positionDetails.canUnstake,
          integrationData,
          pendingActions: positionDetails.pendingActions.orDefault([]),
          personalizedRewardRate: positionDetails.personalizedRewardRate,
          positionBalancesByType,
          providersDetails: positionDetails.providersDetails.orDefault([]),
          reducedStakedOrLiquidBalance:
            positionDetails.reducedStakedOrLiquidBalance.extractNullable(),
          rewardsSummary: rewardsSummaryQuery.data?.data,
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
                        <Text className={styles.breakdownValue}>
                          {row.value}
                        </Text>
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
                <Box
                  display="flex"
                  flexDirection="column"
                  gap="2"
                  marginTop="2"
                >
                  {model.addressRows.map((row) => (
                    <AddressRow key={`${row.label}-${row.address}`} {...row} />
                  ))}
                </Box>
              )}
            </DetailsSection>
          </Box>
        );
      })
    )
    .orDefault(
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
