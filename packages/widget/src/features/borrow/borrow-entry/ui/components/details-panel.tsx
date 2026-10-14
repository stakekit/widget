import { useTranslation } from "react-i18next";
import type { CollateralToken } from "../../../../../domain/borrow/catalog/collateral-token";
import type { Integration } from "../../../../../domain/borrow/catalog/integration";
import type { Market } from "../../../../../domain/borrow/catalog/market";
import { exactZero } from "../../../../../domain/finance/exact";
import {
  formatBorrowProviderName,
  formatNetworkName,
} from "../../../../../shared/lib/formatters";
import {
  dashboardDetailsScroll,
  dashboardMetricCard,
  dashboardMetricGrid,
} from "../../../../../shared/ui/components/dashboard-details/styles.css";
import {
  AddressRow,
  DetailRow,
  DetailsSection,
} from "../../../../../shared/ui/components/details-section";
import { TokenIcon } from "../../../../../shared/ui/components/token-icon";
import { Box } from "../../../../../shared/ui/primitives/box";
import { ContentLoaderSquare } from "../../../../../shared/ui/primitives/content-loader";
import { HeaderBadge } from "../../../../../shared/ui/primitives/header-badge";
import { Image } from "../../../../../shared/ui/primitives/image";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { useWidgetPresentation } from "../../../../../shared/ui/widget-presentation";
import type {
  BorrowEntryView,
  BorrowFormProjection,
} from "../../model/borrow-entry";
import { getBorrowDetailsModel } from "../../model/details";
import { toBorrowEntryToken } from "../../model/market-groups";
import * as styles from "../styles.css";
import { BorrowDetailsEmpty } from "./notices";

const BorrowMetricGrid = ({
  cards,
}: {
  readonly cards: ReturnType<typeof getBorrowDetailsModel>["metricCards"];
}) => (
  <Box className={dashboardMetricGrid}>
    {cards.map((card) => (
      <Box
        className={dashboardMetricCard}
        display="flex"
        flexDirection="column"
        gap="1"
        key={card.id}
      >
        <Text variant={{ type: "muted", weight: "normal" }}>{card.label}</Text>
        <Text variant={{ weight: "bold" }}>{card.value}</Text>
        {card.subValue ? (
          <Text variant={{ type: "muted", weight: "normal" }}>
            {card.subValue}
          </Text>
        ) : null}
      </Box>
    ))}
  </Box>
);

/** The entry form's details pane: the live selection, with catalog states. */
export const BorrowEntryDetailsPanel = ({
  view,
}: {
  readonly view: BorrowEntryView;
}) => {
  const { t } = useTranslation();
  const {
    integrationsView,
    marketsView,
    projection,
    selectedIntegration,
    selectedMarket,
    walletBalances,
  } = view;

  if (marketsView._tag === "Loading" || integrationsView._tag === "Loading") {
    return <ContentLoaderSquare heightPx={430} />;
  }

  if (marketsView._tag === "Failed" || integrationsView._tag === "Failed") {
    return (
      <BorrowDetailsEmpty title={t("dashboard.borrow.error_title")}>
        {t("dashboard.borrow.error_description")}
      </BorrowDetailsEmpty>
    );
  }

  if (!selectedMarket) {
    return (
      <BorrowDetailsEmpty title={t("dashboard.borrow.details.empty_title")}>
        {t("dashboard.borrow.details.empty_description")}
      </BorrowDetailsEmpty>
    );
  }

  return (
    <BorrowMarketDetails
      collateralToken={
        walletBalances?.selectedCollateralToken?.collateralToken ?? null
      }
      integration={selectedIntegration}
      market={selectedMarket}
      projection={projection}
    />
  );
};

/** Describes one market: rates, stats and protocol facts. */
export const BorrowMarketDetails = ({
  collateralToken,
  integration,
  market,
  projection,
}: {
  readonly collateralToken: CollateralToken | null;
  readonly integration: Integration | null;
  readonly market: Market;
  readonly projection?: BorrowFormProjection;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const model = getBorrowDetailsModel({
    borrowAmount: exactZero(),
    collateralAmount: exactZero(),
    collateralToken,
    integration,
    locale,
    market,
    projection,
    t,
  });
  const loanToken = toBorrowEntryToken({
    network: market.network,
    token: market.loanToken,
  });
  const providerName = formatBorrowProviderName(
    integration?.name ?? market.integrationId
  );

  return (
    <Box
      className={dashboardDetailsScroll}
      display="flex"
      flexDirection="column"
      gap="4"
    >
      <Box className={styles.detailsHeader}>
        <TokenIcon token={loanToken} tokenLogoHw="12" />

        <Box minWidth="0">
          <Text variant={{ weight: "bold" }}>{model.title}</Text>
          <Box display="flex" alignItems="center" gap="1" flexWrap="wrap">
            <Image
              wrapperProps={{ hw: "5" }}
              imgProps={{ borderRadius: "base" }}
              src={integration?.metadata.logoURI}
              fallbackName={providerName}
            />
            <Text variant={{ type: "muted", weight: "normal" }}>
              {providerName}
              {" · "}
              {formatNetworkName(market.network)}
            </Text>
            <HeaderBadge
              label={t(`dashboard.borrow.market_type.${market.type}`)}
            />
          </Box>
        </Box>
      </Box>

      <BorrowMetricGrid cards={model.metricCards} />

      <DetailsSection title={t("dashboard.borrow.details.about")}>
        <Text variant={{ type: "muted", weight: "normal" }}>
          {integration?.metadata.description ??
            t("dashboard.borrow.details.about_fallback", {
              market: model.title,
              provider: providerName,
            })}
        </Text>
      </DetailsSection>

      <DetailsSection title={t("dashboard.borrow.details.market_stats")}>
        {model.marketRows.map((row) => (
          <DetailRow key={row.id} {...row} />
        ))}
      </DetailsSection>

      <DetailsSection title={t("dashboard.borrow.details.protocol")}>
        {model.protocolRows.map((row) => (
          <DetailRow key={row.id} {...row} />
        ))}

        {market.poolAddress ? (
          <Box marginTop="2">
            <AddressRow
              address={market.poolAddress}
              label={t("dashboard.borrow.details.pool_address")}
            />
          </Box>
        ) : null}
      </DetailsSection>
    </Box>
  );
};
