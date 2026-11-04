import { useAtomSet } from "@effect/atom-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Integration } from "../../../../../domain/borrow/catalog/integration";
import {
  getBorrowMarketPairLabel,
  getListedCollateralTokens,
  getMarketAvailableLiquidityUsd,
  type Market,
} from "../../../../../domain/borrow/catalog/market";
import { getBorrowOriginationFeeBps } from "../../../../../domain/borrow/execution/origination-fee";
import type { MarketId } from "../../../../../domain/borrow/ids";
import { formatBorrowProviderName } from "../../../../../shared/lib/formatters";
import {
  formatPercent,
  formatUsd,
} from "../../../../../shared/lib/number-format";
import {
  useTokenLogo,
  useTokenLogoResolver,
} from "../../../../../shared/react/token-logo";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import { SelectSheet, TokenTrigger } from "../../../../../ui/index";
import {
  filterBorrowMarketGroups,
  toBorrowEntryToken,
} from "../../model/market-groups";
import { selectBorrowMarketAtom } from "../../state/borrow-entry";

/**
 * Chooses the market to borrow from: markets grouped by the token they lend,
 * each group headed by its best rate.
 */
export const MarketSelectSheet = ({
  integrations,
  markets,
  selectedMarketId,
}: {
  readonly integrations: ReadonlyArray<Integration>;
  readonly markets: readonly Market[];
  readonly selectedMarketId: MarketId | null;
}) => {
  const selectedMarket =
    markets.find((market) => market.id === selectedMarketId) ??
    markets[0] ??
    null;

  if (!selectedMarket) {
    return null;
  }

  return (
    <MarketSelect
      integrations={integrations}
      markets={markets}
      selectedMarket={selectedMarket}
    />
  );
};

const MarketSelect = ({
  integrations,
  markets,
  selectedMarket,
}: {
  readonly integrations: ReadonlyArray<Integration>;
  readonly markets: readonly Market[];
  readonly selectedMarket: Market;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const resolveLogo = useTokenLogoResolver();
  const selectMarket = useAtomSet(selectBorrowMarketAtom);
  const [search, setSearch] = useState("");
  const logo = useTokenLogo(
    toBorrowEntryToken({
      network: selectedMarket.network,
      token: selectedMarket.loanToken,
    })
  );

  if (markets.length <= 1) {
    return <TokenTrigger readOnly testId="borrow-market-select" token={logo} />;
  }

  const integrationsById = new Map(
    integrations.map((integration) => [integration.id, integration])
  );
  const marketGroups = filterBorrowMarketGroups({
    integrations,
    markets,
    search,
  });

  return (
    <SelectSheet
      testIds={{
        container: "select-modal__container",
        title: "select-modal__title",
        search: "select-modal__search-input",
      }}
      title={t("dashboard.borrow.form.select_market")}
      closeLabel={t("shared.close")}
      listLabel={t("dashboard.borrow.form.borrowable_assets")}
      trigger={<TokenTrigger testId="borrow-market-select" token={logo} />}
      onOpenChange={(open) => {
        if (!open) setSearch("");
      }}
      selectedId={selectedMarket.id}
      onSelect={(id) => {
        const market = markets.find((candidate) => candidate.id === id);
        if (market) selectMarket(market.id);
      }}
      search={{
        value: search,
        onValueChange: setSearch,
        label: t("shared.search"),
        placeholder: t("dashboard.borrow.form.search_assets"),
        clearLabel: t("shared.clear_search"),
      }}
      empty={{ title: t("dashboard.borrow.form.no_assets") }}
      groups={marketGroups.map((group) => {
        const bestRate = formatPercent(group.bestRate, locale);
        const rate =
          group.marketItems.length > 1
            ? t("dashboard.borrow.form.rate_from", { rate: bestRate })
            : bestRate;

        return {
          key: group.key,
          label: `${group.loanToken.symbol} · ${rate}`,
          options: group.marketItems.map((market) => {
            const providerName = formatBorrowProviderName(
              integrationsById.get(market.integrationId)?.name ??
                market.integrationId
            );
            const isPool = market.type === "pool";
            const feeBps = getBorrowOriginationFeeBps(market);

            return {
              id: market.id,
              testId: `borrow-market-select__item_${market.id}`,
              title: isPool ? providerName : getBorrowMarketPairLabel(market),
              subtitle: isPool
                ? t("dashboard.borrow.form.pooled_collaterals", {
                    count: getListedCollateralTokens(market).length,
                  })
                : providerName,
              value: formatPercent(market.borrowRate, locale),
              subvalue: [
                t("dashboard.borrow.form.liquidity_available", {
                  amount: formatUsd(
                    getMarketAvailableLiquidityUsd(market),
                    locale
                  ),
                }),
                ...(feeBps > 0
                  ? [
                      t("dashboard.borrow.form.origination_fee_value", {
                        value: formatPercent(feeBps / 10_000, locale),
                      }),
                    ]
                  : []),
              ].join(" · "),
              logo: resolveLogo(
                toBorrowEntryToken({
                  network: market.network,
                  token: market.loanToken,
                })
              ),
            };
          }),
        };
      })}
    />
  );
};
