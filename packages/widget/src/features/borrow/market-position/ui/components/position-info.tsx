import { useTranslation } from "react-i18next";
import type { MarketPosition } from "../../../../../domain/borrow/positions/market-position";
import {
  AddressRow,
  DetailRow,
  DetailsSection,
} from "../../../../../shared/ui/components/details-section";
import {
  PositionBreakdownRows,
  PositionDetailsScrollArea,
} from "../../../../../shared/ui/components/position-details";
import {
  TokenIcon,
  TokenIconSkeleton,
} from "../../../../../shared/ui/components/token-icon";
import { Box } from "../../../../../shared/ui/primitives/box";
import {
  ContentLoaderCircle,
  ContentLoaderLine,
} from "../../../../../shared/ui/primitives/content-loader";
import { Image } from "../../../../../shared/ui/primitives/image";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import type {
  BorrowPositionAction,
  getBorrowPositionDetailsModel,
} from "../../model/details";
import { CollateralList } from "./collateral-list";
import { LtvGauge } from "./ltv-gauge";
import { MetricCards } from "./metric-cards";

export const BorrowPositionInfo = (
  props:
    | { readonly content: "loading" }
    | {
        readonly actions: BorrowPositionAction[];
        readonly content: "details" | "fallback";
        readonly model: ReturnType<typeof getBorrowPositionDetailsModel> | null;
        readonly onActionSelect: (action: BorrowPositionAction) => void;
        readonly position: MarketPosition | null;
      }
) => {
  const { t } = useTranslation();
  const model = props.content === "loading" ? null : props.model;
  const position = props.content === "loading" ? null : props.position;

  if (
    props.content !== "loading" &&
    (props.content === "fallback" || !position || !model)
  ) {
    return (
      <Text variant={{ type: "muted", weight: "normal" }}>
        {t("dashboard.borrow.position_details.empty")}
      </Text>
    );
  }

  const detailRows = model?.detailRows ?? [
    { id: "provider", label: t("dashboard.borrow.details.provider") },
    { id: "network", label: t("dashboard.borrow.details.network") },
    { id: "market-type", label: t("dashboard.borrow.details.market_type") },
    { id: "max-ltv", label: t("dashboard.borrow.details.max_ltv") },
    {
      id: "liquidation-threshold",
      label: t("dashboard.borrow.position_details.liquidation_threshold"),
    },
    {
      id: "liquidation-penalty",
      label: t("dashboard.borrow.position_details.liquidation_penalty"),
    },
    { id: "borrow-apy", label: t("dashboard.borrow.details.borrow_apy") },
  ];

  return (
    <PositionDetailsScrollArea>
      <Box aria-busy={!model} display="flex" alignItems="center" gap="2">
        {model ? (
          <TokenIcon token={model.headerToken} tokenLogoHw="12" />
        ) : (
          <TokenIconSkeleton tokenLogoHw="12" />
        )}
        <Box minWidth="0">
          <Text variant={{ weight: "bold" }}>
            {model?.title ?? <ContentLoaderLine widthPx="14ch" />}
          </Text>
          <Box display="flex" alignItems="center" gap="1">
            <Box hw="5" flexShrink={0}>
              {position && model ? (
                <Image
                  wrapperProps={{ hw: "full" }}
                  imgProps={{ borderRadius: "base" }}
                  src={position.integration.metadata.logoURI}
                  fallbackName={model.providerName}
                />
              ) : (
                <ContentLoaderCircle />
              )}
            </Box>
            <Text variant={{ type: "muted", weight: "normal" }}>
              {model ? (
                t("positions.via", {
                  providerName: model.providerName,
                  count: 1,
                })
              ) : (
                <>
                  {t("positions.via", { providerName: "", count: 1 })}
                  <ContentLoaderLine widthPx="10ch" />
                </>
              )}
            </Text>
            <Text variant={{ type: "muted", weight: "normal" }}>
              {" · "}
              {model?.marketLabel ?? <ContentLoaderLine widthPx="10ch" />}
            </Text>
          </Box>
        </Box>
      </Box>

      {model ? (
        <MetricCards
          cards={model.metricCards}
          healthFactor={model.healthFactor}
        />
      ) : (
        <MetricCards loading />
      )}

      {model && props.content !== "loading" ? (
        <>
          <LtvGauge
            currentLtv={model.currentLtv}
            liquidationThreshold={model.liquidationThreshold}
          />
          <CollateralList
            actions={props.actions}
            items={model.collateralItems}
            onActionSelect={props.onActionSelect}
            totalCollateralUsd={model.totalCollateralUsd}
          />
          {model.breakdownRows.length > 0 && (
            <DetailsSection title={t("dashboard.position_details.breakdown")}>
              <PositionBreakdownRows rows={model.breakdownRows} />
            </DetailsSection>
          )}
        </>
      ) : null}

      <DetailsSection
        loading={!model}
        title={t("dashboard.borrow.position_details.details")}
      >
        {detailRows.map((row) => (
          <DetailRow
            key={row.id}
            label={row.label}
            loading={!model}
            value={"value" in row ? row.value : null}
          />
        ))}

        {position ? (
          <Box display="flex" flexDirection="column" gap="2" marginTop="2">
            <AddressRow
              address={position.market.poolAddress}
              label={t("dashboard.borrow.details.pool_address")}
            />
          </Box>
        ) : null}
      </DetailsSection>
    </PositionDetailsScrollArea>
  );
};
