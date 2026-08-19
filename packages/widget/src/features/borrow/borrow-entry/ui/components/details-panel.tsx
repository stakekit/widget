import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useTranslation } from "react-i18next";
import {
  formatBorrowProviderName,
  formatNetworkName,
} from "../../../../../shared/lib/formatters";
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
import type { BorrowEntryView } from "../../model/borrow-entry";
import { getBorrowDetailsModel } from "../../model/details";
import { toBorrowEntryToken } from "../../model/market-groups";
import * as styles from "../styles.css";
import { BorrowDetailsEmpty } from "./notices";

const BorrowMetricGrid = ({
  cards,
}: {
  readonly cards: ReturnType<typeof getBorrowDetailsModel>["metricCards"];
}) => (
  <Box className={styles.metricGrid}>
    {cards.map((card) => (
      <Box
        className={styles.metricCard}
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

export const BorrowDetailsPanel = ({
  view,
}: {
  readonly view: BorrowEntryView;
}) => {
  const { t } = useTranslation();
  const {
    borrowAmount,
    collateralAmount,
    integrationsResult,
    marketsResult,
    projection,
    selectedIntegration,
    selectedMarket,
    walletBalances,
  } = view;

  if (
    AsyncResult.isInitial(marketsResult) ||
    AsyncResult.isWaiting(marketsResult) ||
    AsyncResult.isInitial(integrationsResult) ||
    AsyncResult.isWaiting(integrationsResult)
  ) {
    return <ContentLoaderSquare heightPx={430} />;
  }

  if (
    AsyncResult.isFailure(marketsResult) ||
    AsyncResult.isFailure(integrationsResult)
  ) {
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

  const model = getBorrowDetailsModel({
    balances: walletBalances,
    borrowAmount,
    collateralAmount,
    integration: selectedIntegration,
    market: selectedMarket,
    projection,
    t,
  });
  const loanToken = toBorrowEntryToken({
    network: selectedMarket.network,
    token: selectedMarket.loanToken,
  });
  const providerName = formatBorrowProviderName(
    selectedIntegration?.name ?? selectedMarket.integrationId
  );

  return (
    <Box
      className={styles.detailsScroll}
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
              src={selectedIntegration?.metadata.logoURI}
              fallbackName={providerName}
            />
            <Text variant={{ type: "muted", weight: "normal" }}>
              {providerName}
              {" · "}
              {formatNetworkName(selectedMarket.network)}
            </Text>
            <HeaderBadge
              label={t(`dashboard.borrow.market_type.${selectedMarket.type}`)}
            />
          </Box>
        </Box>
      </Box>

      <BorrowMetricGrid cards={model.metricCards} />

      <DetailsSection title={t("dashboard.borrow.details.about")}>
        <Text variant={{ type: "muted", weight: "normal" }}>
          {selectedIntegration?.metadata.description ??
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

        {selectedMarket.poolAddress ? (
          <Box marginTop="2">
            <AddressRow
              address={selectedMarket.poolAddress}
              label={t("dashboard.borrow.details.pool_address")}
            />
          </Box>
        ) : null}
      </DetailsSection>
    </Box>
  );
};
