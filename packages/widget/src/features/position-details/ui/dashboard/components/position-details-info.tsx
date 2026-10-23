import { useAtomValue } from "@effect/atom-react";
import { useTranslation } from "react-i18next";
import { presentationClockAtom } from "../../../../../shared/effect/presentation-clock";
import {
  AddressRow,
  DetailRow,
  DetailsSection,
} from "../../../../../shared/ui/components/details-section";
import {
  PositionBreakdownRows,
  PositionDetailsScrollArea,
  PositionMetricCards,
} from "../../../../../shared/ui/components/position-details";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Button } from "../../../../../shared/ui/primitives/button";
import { ContentLoaderSquare } from "../../../../../shared/ui/primitives/content-loader";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { useWidgetPresentation } from "../../../../../shared/ui/widget-presentation";
import {
  CurrentRewardsSummaryKey,
  currentRewardsSummaryAtom,
} from "../../../../yield-summary/index";
import {
  RiskRatingBadge,
  riskSummaryActions,
  YieldDetailsHeader,
  YieldRiskInfoTooltip,
} from "../../../../yield-summary/views";
import {
  type DashboardPositionDetailValue,
  getDashboardPositionDetailsModel,
  getPositionHeaderBadges,
} from "../../../model/dashboard-position-details";
import { usePositionDetails } from "../../classic/hooks/use-position-details";

const renderDetailValue = (value: DashboardPositionDetailValue) =>
  typeof value === "string" ? (
    value
  ) : (
    <div className={riskSummaryActions}>
      <RiskRatingBadge risk={value.risk} />
      <YieldRiskInfoTooltip />
    </div>
  );

export const PositionDetailsInfo = () => {
  const positionDetails = usePositionDetails();
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const presentationTime = useAtomValue(presentationClockAtom);

  const rewardsYieldId = positionDetails.integrationData?.id ?? null;
  const rewardsSummaries = useAtomValue(
    currentRewardsSummaryAtom(
      new CurrentRewardsSummaryKey({
        yieldIds: rewardsYieldId ? [rewardsYieldId] : [],
      })
    )
  );

  if (positionDetails.isLoading) {
    return <ContentLoaderSquare heightPx={430} />;
  }

  const integrationData = positionDetails.integrationData;
  const positionBalancesByType = positionDetails.positionBalancesByType;
  if (integrationData && positionBalancesByType) {
    const model = getDashboardPositionDetailsModel({
      cancellingHandles: positionDetails.cancellingHandles,
      canUnstake: positionDetails.canUnstake,
      integrationData,
      locale,
      now: presentationTime?.now ?? null,
      pendingActions: positionDetails.pendingActions ?? [],
      personalizedRewardRate: positionDetails.personalizedRewardRate,
      positionBalancesByType,
      providersDetails: positionDetails.providersDetails ?? [],
      rewardsSummary:
        rewardsYieldId && rewardsSummaries._tag === "Ready"
          ? (rewardsSummaries.value?.[rewardsYieldId] ?? undefined)
          : undefined,
      t,
    });

    return (
      <PositionDetailsScrollArea>
        <YieldDetailsHeader
          headerBadges={getPositionHeaderBadges(integrationData, t)}
          providerName={model.providerName}
          yieldDto={integrationData}
        />

        <PositionMetricCards cards={model.metricCards} />

        {model.breakdownRows.length > 0 && (
          <DetailsSection title={t("dashboard.position_details.breakdown")}>
            <PositionBreakdownRows rows={model.breakdownRows} />
            {positionDetails.hasHiddenBalances ? (
              <Box display="flex" flexDirection="column" gap="1" marginTop="2">
                <Button
                  variant={{ size: "small", color: "smallButtonLight" }}
                  disabled={positionDetails.revealing}
                  isLoading={positionDetails.revealing}
                  onClick={positionDetails.onRevealBalances}
                >
                  <Text>{t("shared.confidential.reveal")}</Text>
                </Button>
                {positionDetails.revealFailed ? (
                  <Text variant={{ type: "danger", weight: "normal" }}>
                    {t("shared.confidential.reveal_failed")}
                  </Text>
                ) : null}
              </Box>
            ) : null}
            {positionDetails.hasRevealedBalances ? (
              <Box marginTop="2" display="flex" flexDirection="column">
                <Button
                  variant={{ size: "small", color: "smallButtonLight" }}
                  onClick={positionDetails.onHideBalances}
                >
                  <Text>{t("shared.confidential.hide")}</Text>
                </Button>
              </Box>
            ) : null}
          </DetailsSection>
        )}

        <DetailsSection title={t("dashboard.position_details.details")}>
          {model.detailRows.map((row) => (
            <DetailRow
              key={row.id}
              id={row.id}
              label={row.label}
              value={renderDetailValue(row.value)}
            />
          ))}

          {model.addressRows.length > 0 && (
            <Box display="flex" flexDirection="column" gap="2" marginTop="2">
              {model.addressRows.map((row) => (
                <AddressRow key={`${row.label}-${row.address}`} {...row} />
              ))}
            </Box>
          )}
        </DetailsSection>
      </PositionDetailsScrollArea>
    );
  }

  return (
    <PositionDetailsScrollArea>
      <Box alignItems="center" display="flex" justifyContent="center">
        <Text variant={{ type: "muted", weight: "normal" }}>
          {t("dashboard.position_details.empty")}
        </Text>
      </Box>
    </PositionDetailsScrollArea>
  );
};
