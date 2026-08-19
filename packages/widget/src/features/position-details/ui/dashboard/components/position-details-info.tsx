import { useTranslation } from "react-i18next";
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
import { ContentLoaderSquare } from "../../../../../shared/ui/primitives/content-loader";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
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

import { useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
