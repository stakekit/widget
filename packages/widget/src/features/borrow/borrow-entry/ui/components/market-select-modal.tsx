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
import { formatBorrowProviderName } from "../../../../../shared/lib/formatters";
import {
  formatPercent,
  formatUsd,
} from "../../../../../shared/lib/number-format";
import { SelectModal } from "../../../../../shared/ui/components/select-modal";
import {
  SelectedToken,
  SelectTokenTrigger,
} from "../../../../../shared/ui/components/selected-token";
import { Box } from "../../../../../shared/ui/primitives/box";
import { useWidgetPresentation } from "../../../../../shared/ui/widget-presentation";
import {
  filterBorrowMarketGroups,
  toBorrowEntryToken,
} from "../../model/market-groups";
import { selectBorrowMarketAtom } from "../../state/borrow-entry";
import * as styles from "../styles.css";
import {
  BorrowAssetSelectorList,
  BorrowAssetSelectorRow,
  BorrowSelectorEmpty,
} from "./asset-selector";

export const MarketSelectModal = ({
  integrations,
  markets,
  selectedMarketId,
}: {
  readonly integrations: ReadonlyArray<Integration>;
  readonly markets: readonly Market[];
  readonly selectedMarketId: string | null;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const selectMarket = useAtomSet(selectBorrowMarketAtom);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);
  const selectedMarket =
    markets.find((market) => market.id === selectedMarketId) ??
    markets[0] ??
    null;

  if (!selectedMarket) {
    return null;
  }

  const token = toBorrowEntryToken({
    network: selectedMarket.network,
    token: selectedMarket.loanToken,
  });
  const integrationsById = new Map(
    integrations.map((integration) => [integration.id, integration])
  );
  const marketGroups = filterBorrowMarketGroups({
    integrations,
    markets,
    search,
  });

  const onOpenChange = (open: boolean) => {
    setIsOpen(open);

    if (!open) {
      setExpandedGroupKey(null);
      setSearch("");
    }
  };

  if (markets.length <= 1) {
    return <SelectedToken testId="borrow-market-select" token={token} />;
  }

  return (
    <SelectModal
      inputPlaceholder={t("dashboard.borrow.form.search_assets")}
      onSearch={setSearch}
      searchValue={search}
      state={{ isOpen, setOpen: onOpenChange }}
      title={t("dashboard.borrow.form.select_market")}
      trigger={
        <SelectTokenTrigger testId="borrow-market-select" token={token} />
      }
    >
      <BorrowAssetSelectorList
        columnLabel={t("dashboard.borrow.form.borrow_rate")}
        title={t("dashboard.borrow.form.borrowable_assets")}
      >
        {marketGroups.length === 0 ? (
          <BorrowSelectorEmpty>
            {t("dashboard.borrow.form.no_assets")}
          </BorrowSelectorEmpty>
        ) : (
          marketGroups.map((group) => {
            const isExpanded = expandedGroupKey === group.key;
            const bestRate = formatPercent(group.bestRate, locale);

            return (
              <Box className={styles.assetSelectorGroup} key={group.key}>
                <BorrowAssetSelectorRow
                  expandable
                  expanded={isExpanded}
                  label={group.loanToken.symbol}
                  onClick={() =>
                    setExpandedGroupKey((previous) =>
                      previous === group.key ? null : group.key
                    )
                  }
                  rate={
                    group.marketItems.length > 1
                      ? t("dashboard.borrow.form.rate_from", { rate: bestRate })
                      : bestRate
                  }
                  selected={isExpanded}
                  testId={`borrow-market-select__group_${group.loanToken.symbol.toLowerCase()}`}
                  token={toBorrowEntryToken({
                    network: group.network,
                    token: group.loanToken,
                  })}
                />

                {isExpanded
                  ? group.marketItems.map((market) => {
                      const providerName = formatBorrowProviderName(
                        integrationsById.get(market.integrationId)?.name ??
                          market.integrationId
                      );
                      const isPool = market.type === "pool";
                      const feeBps = getBorrowOriginationFeeBps(market);

                      return (
                        <BorrowAssetSelectorRow
                          indented
                          key={market.id}
                          label={
                            isPool
                              ? providerName
                              : getBorrowMarketPairLabel(market)
                          }
                          meta={
                            isPool
                              ? t("dashboard.borrow.form.pooled_collaterals", {
                                  count:
                                    getListedCollateralTokens(market).length,
                                })
                              : providerName
                          }
                          onClick={() => {
                            selectMarket(market.id);
                            onOpenChange(false);
                          }}
                          rate={formatPercent(market.borrowRate, locale)}
                          rateMeta={[
                            t("dashboard.borrow.form.liquidity_available", {
                              amount: formatUsd(
                                getMarketAvailableLiquidityUsd(market),
                                locale
                              ),
                            }),
                            ...(feeBps > 0
                              ? [
                                  t(
                                    "dashboard.borrow.form.origination_fee_value",
                                    {
                                      value: formatPercent(
                                        feeBps / 10_000,
                                        locale
                                      ),
                                    }
                                  ),
                                ]
                              : []),
                          ].join(" · ")}
                          selected={market.id === selectedMarketId}
                          testId={`borrow-market-select__item_${market.id}`}
                          token={toBorrowEntryToken({
                            network: market.network,
                            token: market.loanToken,
                          })}
                        />
                      );
                    })
                  : null}
              </Box>
            );
          })
        )}
      </BorrowAssetSelectorList>
    </SelectModal>
  );
};
