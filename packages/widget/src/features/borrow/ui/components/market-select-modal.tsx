import { useAtomSet } from "@effect/atom-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Integration } from "../../../../domain/borrow/integration";
import type { Market } from "../../../../domain/borrow/market";
import { formatBorrowProviderName } from "../../../../shared/lib/formatters";
import { formatNumber } from "../../../../shared/lib/number-format";
import { SelectModal } from "../../../../shared/ui/components/select-modal";
import { Box } from "../../../../shared/ui/primitives/box";
import { getBorrowMarketPairLabel } from "../../model/borrow-details-model";
import {
  filterBorrowMarketGroups,
  toDashboardToken,
} from "../../model/market-groups";
import { selectBorrowMarketAtom } from "../../state/form";
import * as styles from "../styles.css";
import {
  AmountTokenSelectTrigger,
  BorrowAssetSelectorList,
  BorrowAssetSelectorRow,
  BorrowSelectorEmpty,
  StaticAmountTokenButton,
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

  const token = toDashboardToken({
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
    return <StaticAmountTokenButton token={token} />;
  }

  return (
    <SelectModal
      inputPlaceholder={t("dashboard.borrow.form.search_assets")}
      onSearch={setSearch}
      searchValue={search}
      state={{ isOpen, setOpen: onOpenChange }}
      title={t("dashboard.borrow.form.select_market")}
      trigger={
        <AmountTokenSelectTrigger testId="borrow-market-select" token={token} />
      }
    >
      <BorrowAssetSelectorList
        title={t("dashboard.borrow.form.borrowable_assets")}
      >
        {marketGroups.length === 0 ? (
          <BorrowSelectorEmpty>
            {t("dashboard.borrow.form.no_assets")}
          </BorrowSelectorEmpty>
        ) : (
          marketGroups.map((group) => {
            const isExpanded = expandedGroupKey === group.key;

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
                  rate={`${formatNumber(group.bestRate * 100, 2)}%`}
                  selected={isExpanded}
                  testId={`borrow-market-select__group_${group.loanToken.symbol.toLowerCase()}`}
                  token={toDashboardToken({
                    network: group.network,
                    token: group.loanToken,
                  })}
                />

                {isExpanded
                  ? group.marketItems.map((market) => (
                      <BorrowAssetSelectorRow
                        indented
                        key={market.id}
                        label={getBorrowMarketPairLabel(market)}
                        meta={formatBorrowProviderName(
                          integrationsById.get(market.integrationId)?.name ??
                            market.integrationId
                        )}
                        onClick={() => {
                          selectMarket(market.id);
                          onOpenChange(false);
                        }}
                        rate={`${formatNumber(market.borrowRate * 100, 2)}%`}
                        selected={market.id === selectedMarketId}
                        testId={`borrow-market-select__item_${market.id}`}
                        token={toDashboardToken({
                          network: market.network,
                          token: market.loanToken,
                        })}
                      />
                    ))
                  : null}
              </Box>
            );
          })
        )}
      </BorrowAssetSelectorList>
    </SelectModal>
  );
};
