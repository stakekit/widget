import { useAtomSet } from "@effect/atom-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { CollateralToken } from "../../../../../domain/borrow/catalog/collateral-token";
import { decodeTokenId, type TokenId } from "../../../../../domain/borrow/ids";
import type { BorrowNetwork } from "../../../../../domain/borrow/network";
import { formatNumber } from "../../../../../shared/lib/number-format";
import { SelectModal } from "../../../../../shared/ui/components/select-modal";
import {
  filterBorrowCollateralTokens,
  toBorrowEntryToken,
} from "../../model/market-groups";
import { selectBorrowCollateralTokenAtom } from "../../state/borrow-entry";
import {
  AmountTokenSelectTrigger,
  BorrowAssetSelectorList,
  BorrowAssetSelectorRow,
  BorrowSelectorEmpty,
  StaticAmountTokenButton,
} from "./asset-selector";

export const CollateralSelectModal = ({
  collateralTokens,
  marketNetwork,
  selectedCollateralTokenId,
}: {
  readonly collateralTokens: readonly CollateralToken[];
  readonly marketNetwork: BorrowNetwork;
  readonly selectedCollateralTokenId: TokenId | null;
}) => {
  const { t } = useTranslation();
  const selectCollateralToken = useAtomSet(selectBorrowCollateralTokenAtom);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selectedCollateralToken =
    collateralTokens.find(
      (collateralToken) =>
        decodeTokenId(collateralToken.token) === selectedCollateralTokenId
    ) ??
    collateralTokens[0] ??
    null;

  if (!selectedCollateralToken) {
    return null;
  }

  const token = toBorrowEntryToken({
    network: marketNetwork,
    token: selectedCollateralToken.token,
  });
  const filteredCollateralTokens = filterBorrowCollateralTokens({
    collateralTokens,
    search,
  });

  const onOpenChange = (open: boolean) => {
    setIsOpen(open);

    if (!open) {
      setSearch("");
    }
  };

  if (collateralTokens.length <= 1) {
    return <StaticAmountTokenButton token={token} />;
  }

  return (
    <SelectModal
      inputPlaceholder={t("dashboard.borrow.form.search_assets")}
      onSearch={setSearch}
      searchValue={search}
      state={{ isOpen, setOpen: onOpenChange }}
      title={t("dashboard.borrow.form.select_collateral")}
      trigger={
        <AmountTokenSelectTrigger
          testId="borrow-collateral-select"
          token={token}
        />
      }
    >
      <BorrowAssetSelectorList
        title={t("dashboard.borrow.form.collateral_assets")}
      >
        {filteredCollateralTokens.length === 0 ? (
          <BorrowSelectorEmpty>
            {t("dashboard.borrow.form.no_assets")}
          </BorrowSelectorEmpty>
        ) : (
          filteredCollateralTokens.map((collateralToken) => (
            <BorrowAssetSelectorRow
              key={
                collateralToken.token.address ?? collateralToken.token.symbol
              }
              label={collateralToken.token.symbol}
              meta={t("dashboard.borrow.form.max_ltv", {
                value: formatNumber(collateralToken.maxLtv * 100, 2),
              })}
              onClick={() => {
                selectCollateralToken(collateralToken);
                onOpenChange(false);
              }}
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
          ))
        )}
      </BorrowAssetSelectorList>
    </SelectModal>
  );
};
