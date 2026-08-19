import { useTranslation } from "react-i18next";
import type { MarketPosition } from "../../../../../domain/borrow/positions/market-position";
import {
  AddressRow,
  DetailRow,
  DetailsSection,
} from "../../../../../shared/ui/components/details-section";
import { TokenIcon } from "../../../../../shared/ui/components/token-icon";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Image } from "../../../../../shared/ui/primitives/image";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { positionDetailsComponentStyles as positionDetailsStyles } from "../../../../position-details/views";
import type {
  BorrowPositionAction,
  getBorrowPositionDetailsModel,
} from "../../model/details";
import { CollateralList } from "./collateral-list";
import { LtvGauge } from "./ltv-gauge";
import { MetricCards } from "./metric-cards";

export const BorrowPositionInfo = ({
  actions,
  content,
  model,
  onActionSelect,
  position,
}: {
  readonly actions: BorrowPositionAction[];
  readonly content: "details" | "fallback";
  readonly model: ReturnType<typeof getBorrowPositionDetailsModel> | null;
  readonly onActionSelect: (action: BorrowPositionAction) => void;
  readonly position: MarketPosition | null;
}) => {
  const { t } = useTranslation();

  if (content === "fallback" || !position || !model) {
    return (
      <Text variant={{ type: "muted", weight: "normal" }}>
        {t("dashboard.borrow.position_details.empty")}
      </Text>
    );
  }

  return (
    <Box
      className={positionDetailsStyles.infoContainer}
      display="flex"
      flexDirection="column"
      gap="4"
    >
      <Box display="flex" alignItems="center" gap="2">
        <TokenIcon token={model.headerToken} tokenLogoHw="12" />
        <Box minWidth="0">
          <Text variant={{ weight: "bold" }}>{model.title}</Text>
          <Box display="flex" alignItems="center" gap="1">
            <Image
              wrapperProps={{ hw: "5" }}
              imgProps={{ borderRadius: "base" }}
              src={position.integration.metadata.logoURI}
              fallbackName={model.providerName}
            />
            <Text variant={{ type: "muted", weight: "normal" }}>
              {t("positions.via", {
                providerName: model.providerName,
                count: 1,
              })}
            </Text>
            <Text variant={{ type: "muted", weight: "normal" }}>
              {" · "}
              {model.marketLabel}
            </Text>
          </Box>
        </Box>
      </Box>

      <MetricCards
        cards={model.metricCards}
        healthFactor={model.healthFactor}
      />

      <LtvGauge
        currentLtv={model.currentLtv}
        liquidationThreshold={model.liquidationThreshold}
      />

      <CollateralList
        actions={actions}
        items={model.collateralItems}
        onActionSelect={onActionSelect}
        totalCollateralUsd={model.totalCollateralUsd}
      />

      {model.breakdownRows.length > 0 && (
        <DetailsSection title={t("dashboard.position_details.breakdown")}>
          <Box display="flex" flexDirection="column">
            {model.breakdownRows.map((row) => (
              <Box className={positionDetailsStyles.breakdownRow} key={row.id}>
                <Text variant={{ type: "muted", weight: "normal" }}>
                  {row.label}
                </Text>

                <Box className={positionDetailsStyles.breakdownAmounts}>
                  <Text className={positionDetailsStyles.breakdownValue}>
                    {row.value}
                  </Text>
                  {row.subValue && (
                    <Text
                      className={positionDetailsStyles.breakdownSubValue}
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

      <DetailsSection title={t("dashboard.borrow.position_details.details")}>
        {model.detailRows.map((row) => (
          <DetailRow key={row.id} {...row} />
        ))}

        <Box display="flex" flexDirection="column" gap="2" marginTop="2">
          <AddressRow
            address={position.market.poolAddress}
            label={t("dashboard.borrow.details.pool_address")}
          />
        </Box>
      </DetailsSection>
    </Box>
  );
};
