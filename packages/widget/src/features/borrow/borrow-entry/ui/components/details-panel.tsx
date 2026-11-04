import { useTranslation } from "react-i18next";
import type { CollateralToken } from "../../../../../domain/borrow/catalog/collateral-token";
import type { Integration } from "../../../../../domain/borrow/catalog/integration";
import type { Market } from "../../../../../domain/borrow/catalog/market";
import { exactZero } from "../../../../../domain/finance/exact";
import {
  formatBorrowProviderName,
  formatNetworkName,
} from "../../../../../shared/lib/formatters";
import { formatAddress } from "../../../../../shared/lib/general";
import { useTokenLogo } from "../../../../../shared/react/token-logo";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import {
  AssetHeader,
  DetailList,
  DetailRow,
  Disclosure,
  EmptyState,
  Metric,
  MetricGroup,
  Stack,
  Text,
} from "../../../../../ui/index";
import type {
  BorrowEntryView,
  BorrowFormProjection,
} from "../../model/borrow-entry";
import { getBorrowDetailsModel } from "../../model/details";
import { toBorrowEntryToken } from "../../model/market-groups";
import { BorrowDetailsSkeleton } from "./skeletons";

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
    return <BorrowDetailsSkeleton />;
  }

  if (marketsView._tag === "Failed" || integrationsView._tag === "Failed") {
    return (
      <EmptyState
        title={t("dashboard.borrow.error_title")}
        body={t("dashboard.borrow.error_description")}
      />
    );
  }

  if (!selectedMarket) {
    return (
      <EmptyState
        title={t("dashboard.borrow.details.empty_title")}
        body={t("dashboard.borrow.details.empty_description")}
      />
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
  const loanTokenLogo = useTokenLogo(
    toBorrowEntryToken({ network: market.network, token: market.loanToken })
  );
  const providerName = formatBorrowProviderName(
    integration?.name ?? market.integrationId
  );

  return (
    <Stack gap={16}>
      <AssetHeader
        title={model.title}
        token={loanTokenLogo}
        provider={{
          name: providerName,
          label: providerName,
          ...(integration?.metadata.logoURI
            ? { src: integration.metadata.logoURI }
            : {}),
        }}
        details={[formatNetworkName(market.network)]}
        badges={[{ label: t(`dashboard.borrow.market_type.${market.type}`) }]}
      />

      <MetricGroup columns={2}>
        {model.metricCards.map((card) => (
          <Metric
            key={card.id}
            label={card.label}
            value={card.value}
            {...(card.subValue ? { caption: card.subValue } : {})}
          />
        ))}
      </MetricGroup>

      <Disclosure title={t("dashboard.borrow.details.about")} defaultOpen>
        <Text as="p" tone="muted">
          {integration?.metadata.description ??
            t("dashboard.borrow.details.about_fallback", {
              market: model.title,
              provider: providerName,
            })}
        </Text>
      </Disclosure>

      <Disclosure
        title={t("dashboard.borrow.details.market_stats")}
        defaultOpen
      >
        <DetailList>
          {model.marketRows.map((row) => (
            <DetailRow
              key={row.id}
              label={row.label}
              value={row.value}
              tone={row.tone ?? "default"}
            />
          ))}
        </DetailList>
      </Disclosure>

      <Disclosure title={t("dashboard.borrow.details.protocol")} defaultOpen>
        <DetailList>
          {model.protocolRows.map((row) => (
            <DetailRow
              key={row.id}
              label={row.label}
              value={row.value}
              tone={row.tone ?? "default"}
            />
          ))}
          {market.poolAddress ? (
            <DetailRow
              label={t("dashboard.borrow.details.pool_address")}
              value={formatAddress(market.poolAddress)}
              copyable={{
                value: market.poolAddress,
                label: t("wallet_modal.copy_address"),
                copiedLabel: t("wallet_modal.copied"),
              }}
            />
          ) : null}
        </DetailList>
      </Disclosure>
    </Stack>
  );
};
