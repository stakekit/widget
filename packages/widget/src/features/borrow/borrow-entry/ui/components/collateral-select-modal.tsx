import { useAtomSet } from "@effect/atom-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { decodeTokenId, type TokenId } from "../../../../../domain/borrow/ids";
import type { BorrowNetwork } from "../../../../../domain/borrow/network";
import {
  formatPercent,
  formatTokenAmount,
  formatUsd,
} from "../../../../../shared/lib/number-format";
import { SelectModal } from "../../../../../shared/ui/components/select-modal";
import {
  SelectedToken,
  SelectTokenTrigger,
} from "../../../../../shared/ui/components/selected-token";
import { useWidgetPresentation } from "../../../../../shared/ui/widget-presentation";
import {
  type BorrowCollateralOption,
  filterBorrowCollateralOptions,
  toBorrowEntryToken,
} from "../../model/market-groups";
import { selectBorrowCollateralTokenAtom } from "../../state/borrow-entry";
import {
  BorrowAssetSelectorList,
  BorrowAssetSelectorRow,
  BorrowSelectorEmpty,
} from "./asset-selector";

// Smaller supply rates format as "<0.01%" and read as noise next to LTV terms.
const MIN_SHOWN_SUPPLY_RATE = 0.0001;

export const CollateralSelectModal = ({
  collateralOptions,
  marketNetwork,
  selectedCollateralTokenId,
}: {
  readonly collateralOptions: readonly BorrowCollateralOption[];
  readonly marketNetwork: BorrowNetwork;
  readonly selectedCollateralTokenId: TokenId | null;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const selectCollateralToken = useAtomSet(selectBorrowCollateralTokenAtom);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selectedCollateralToken =
    collateralOptions.find(
      ({ collateralToken }) =>
        decodeTokenId(collateralToken.token) === selectedCollateralTokenId
    )?.collateralToken ??
    collateralOptions[0]?.collateralToken ??
    null;

  if (!selectedCollateralToken) {
    return null;
  }

  const token = toBorrowEntryToken({
    network: marketNetwork,
    token: selectedCollateralToken.token,
  });
  const filteredOptions = filterBorrowCollateralOptions({
    options: collateralOptions,
    search,
  });
  const holdsAnyCollateral = collateralOptions.some(({ walletAmount }) =>
    walletAmount?.gt(0)
  );

  const onOpenChange = (open: boolean) => {
    setIsOpen(open);

    if (!open) {
      setSearch("");
    }
  };

  if (collateralOptions.length <= 1) {
    return <SelectedToken testId="borrow-collateral-select" token={token} />;
  }

  return (
    <SelectModal
      inputPlaceholder={t("dashboard.borrow.form.search_assets")}
      onSearch={setSearch}
      searchValue={search}
      state={{ isOpen, setOpen: onOpenChange }}
      title={t("dashboard.borrow.form.select_collateral")}
      trigger={
        <SelectTokenTrigger testId="borrow-collateral-select" token={token} />
      }
    >
      <BorrowAssetSelectorList
        columnLabel={
          holdsAnyCollateral
            ? t("dashboard.borrow.form.balance_column")
            : undefined
        }
        title={t("dashboard.borrow.form.collateral_assets")}
      >
        {filteredOptions.length === 0 ? (
          <BorrowSelectorEmpty>
            {t("dashboard.borrow.form.no_assets")}
          </BorrowSelectorEmpty>
        ) : (
          filteredOptions.map(
            ({ collateralToken, walletAmount, walletUsd }) => (
              <BorrowAssetSelectorRow
                key={
                  collateralToken.token.address ?? collateralToken.token.symbol
                }
                label={collateralToken.token.symbol}
                labelMeta={
                  collateralToken.supplyRate.gte(MIN_SHOWN_SUPPLY_RATE)
                    ? t("dashboard.borrow.form.collateral_earns", {
                        rate: formatPercent(collateralToken.supplyRate, locale),
                      })
                    : undefined
                }
                meta={t("dashboard.borrow.form.collateral_terms", {
                  liquidationThreshold: formatPercent(
                    collateralToken.liquidationThreshold,
                    locale
                  ),
                  maxLtv: formatPercent(collateralToken.maxLtv, locale),
                })}
                onClick={() => {
                  selectCollateralToken(collateralToken);
                  onOpenChange(false);
                }}
                rate={
                  walletAmount?.gt(0)
                    ? formatTokenAmount(walletAmount, locale, "down")
                    : undefined
                }
                rateMeta={
                  walletUsd?.gt(0) ? formatUsd(walletUsd, locale) : undefined
                }
                selected={
                  decodeTokenId(collateralToken.token) ===
                  selectedCollateralTokenId
                }
                testId={`borrow-collateral-select__item_${
                  collateralToken.token.address ?? collateralToken.token.symbol
                }`}
                token={toBorrowEntryToken({
                  network: marketNetwork,
                  token: collateralToken.token,
                })}
              />
            )
          )
        )}
      </BorrowAssetSelectorList>
    </SelectModal>
  );
};
