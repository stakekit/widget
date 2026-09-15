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
import {
  TokenIcon,
  TokenIconSkeleton,
} from "../../../../../shared/ui/components/token-icon";
import { Box } from "../../../../../shared/ui/primitives/box";
import {
  ContentLoaderCircle,
  ContentLoaderLine,
} from "../../../../../shared/ui/primitives/content-loader";
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
  readonly cards: ReadonlyArray<{
    readonly id: string;
    readonly label: string;
    readonly loading?: boolean;
    readonly subValue?: string | null;
    readonly value: string | null;
  }>;
}) => (
  <Box className={styles.metricGrid}>
    {cards.map((card) => (
      <Box
        className={styles.metricCard}
        aria-busy={card.loading}
        display="flex"
        flexDirection="column"
        gap="1"
        key={card.id}
      >
        <Text variant={{ type: "muted", weight: "normal" }}>{card.label}</Text>
        <Text variant={{ weight: "bold" }}>
          {card.loading ? <ContentLoaderLine widthPx="7ch" /> : card.value}
        </Text>
        {card.subValue || (card.loading && card.subValue === null) ? (
          <Text variant={{ type: "muted", weight: "normal" }}>
            {card.loading ? <ContentLoaderLine widthPx="5ch" /> : card.subValue}
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
  const { integrationsResult, marketsResult, selectedMarket } = view;

  if (
    (view.markets.length === 0 &&
      (AsyncResult.isInitial(marketsResult) ||
        AsyncResult.isWaiting(marketsResult))) ||
    AsyncResult.isInitial(integrationsResult) ||
    AsyncResult.isWaiting(integrationsResult)
  ) {
    return <BorrowDetailsContent view={null} />;
  }

  if (
    (view.markets.length === 0 && AsyncResult.isFailure(marketsResult)) ||
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

  return <BorrowDetailsContent view={view} />;
};

const BorrowDetailsContent = ({
  view,
}: {
  readonly view: BorrowEntryView | null;
}) => {
  const { t } = useTranslation();
  const selectedMarket = view?.selectedMarket;
  const selectedIntegration = view?.selectedIntegration;
  const model =
    view && selectedMarket
      ? getBorrowDetailsModel({
          balances: view.walletBalances,
          borrowAmount: view.borrowAmount,
          collateralAmount: view.collateralAmount,
          integration: selectedIntegration ?? null,
          market: selectedMarket,
          projection: view.projection,
          t,
        })
      : null;
  const loanToken = selectedMarket
    ? toBorrowEntryToken({
        network: selectedMarket.network,
        token: selectedMarket.loanToken,
      })
    : null;
  const providerName = selectedMarket
    ? formatBorrowProviderName(
        selectedIntegration?.name ?? selectedMarket.integrationId
      )
    : null;
  const metricCards = model?.metricCards ?? [
    {
      id: "borrow-apy",
      label: t("dashboard.borrow.details.borrow_apy"),
      loading: true,
      subValue: null,
      value: null,
    },
    {
      id: "max-ltv",
      label: t("dashboard.borrow.details.max_ltv"),
      loading: true,
      value: null,
    },
  ];
  const marketRows = model?.marketRows ?? [
    { id: "total-supply", label: t("dashboard.borrow.details.total_supply") },
    { id: "total-borrow", label: t("dashboard.borrow.details.total_borrow") },
    {
      id: "available-liquidity",
      label: t("dashboard.borrow.details.available_liquidity"),
    },
    { id: "utilization", label: t("dashboard.borrow.details.utilization") },
  ];
  const protocolRows = model?.protocolRows ?? [
    { id: "provider", label: t("dashboard.borrow.details.provider") },
    { id: "network", label: t("dashboard.borrow.details.network") },
    { id: "market-type", label: t("dashboard.borrow.details.market_type") },
  ];

  return (
    <Box
      className={styles.detailsScroll}
      aria-busy={!model}
      display="flex"
      flexDirection="column"
      gap="4"
    >
      <Box className={styles.detailsHeader}>
        {loanToken ? (
          <TokenIcon token={loanToken} tokenLogoHw="12" />
        ) : (
          <TokenIconSkeleton tokenLogoHw="12" />
        )}
        <Box minWidth="0">
          <Text variant={{ weight: "bold" }}>
            {model?.title ?? <ContentLoaderLine widthPx="14ch" />}
          </Text>
          <Box display="flex" alignItems="center" gap="1" flexWrap="wrap">
            <Box hw="5" flexShrink={0}>
              {providerName ? (
                <Image
                  wrapperProps={{ hw: "full" }}
                  imgProps={{ borderRadius: "base" }}
                  src={selectedIntegration?.metadata.logoURI}
                  fallbackName={providerName}
                />
              ) : (
                <ContentLoaderCircle />
              )}
            </Box>
            <Text variant={{ type: "muted", weight: "normal" }}>
              {providerName ?? <ContentLoaderLine widthPx="10ch" />}
              {" · "}
              {selectedMarket ? (
                formatNetworkName(selectedMarket.network)
              ) : (
                <ContentLoaderLine widthPx="8ch" />
              )}
            </Text>
            <HeaderBadge
              label={
                selectedMarket ? (
                  t(`dashboard.borrow.market_type.${selectedMarket.type}`)
                ) : (
                  <ContentLoaderLine widthPx="6ch" />
                )
              }
            />
          </Box>
        </Box>
      </Box>

      <BorrowMetricGrid cards={metricCards} />

      <DetailsSection
        loading={!model}
        title={t("dashboard.borrow.details.about")}
      >
        <Text variant={{ type: "muted", weight: "normal" }}>
          {model && providerName ? (
            (selectedIntegration?.metadata.description ??
            t("dashboard.borrow.details.about_fallback", {
              market: model.title,
              provider: providerName,
            }))
          ) : (
            <ContentLoaderLine />
          )}
        </Text>
      </DetailsSection>

      <DetailsSection
        loading={!model}
        title={t("dashboard.borrow.details.market_stats")}
      >
        {marketRows.map((row) => (
          <DetailRow
            key={row.id}
            label={row.label}
            loading={!model}
            value={"value" in row ? row.value : null}
          />
        ))}
      </DetailsSection>

      <DetailsSection
        loading={!model}
        title={t("dashboard.borrow.details.protocol")}
      >
        {protocolRows.map((row) => (
          <DetailRow
            key={row.id}
            label={row.label}
            loading={!model}
            value={"value" in row ? row.value : null}
          />
        ))}
        {selectedMarket?.poolAddress ? (
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
