import { useAtomSet } from "@effect/atom-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { CollateralToken } from "../../../../../domain/borrow/catalog/collateral-token";
import { decodeTokenId, type TokenId } from "../../../../../domain/borrow/ids";
import type { BorrowNetwork } from "../../../../../domain/borrow/network";
import {
  formatPercent,
  formatTokenAmount,
  formatUsd,
} from "../../../../../shared/lib/number-format";
import {
  useTokenLogo,
  useTokenLogoResolver,
} from "../../../../../shared/react/token-logo";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import { SelectSheet, TokenTrigger, type Tone } from "../../../../../ui/index";
import {
  type BorrowCollateralOption,
  filterBorrowCollateralOptions,
  toBorrowEntryToken,
} from "../../model/market-groups";
import { selectBorrowCollateralTokenAtom } from "../../state/borrow-entry";

// Smaller supply rates format as "<0.01%" and read as noise next to LTV terms.
const MIN_SHOWN_SUPPLY_RATE = 0.0001;

// A collateral's supply rate is a positive rate, the one use of green.
const earnsTone: Tone = "success";

const optionId = (collateralToken: CollateralToken) =>
  collateralToken.token.address ?? collateralToken.token.symbol;

/** Chooses the collateral to supply from the selected market's tokens. */
export const CollateralSelectSheet = ({
  collateralOptions,
  marketNetwork,
  selectedCollateralTokenId,
}: {
  readonly collateralOptions: readonly BorrowCollateralOption[];
  readonly marketNetwork: BorrowNetwork;
  readonly selectedCollateralTokenId: TokenId | null;
}) => {
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

  return (
    <CollateralSelect
      collateralOptions={collateralOptions}
      marketNetwork={marketNetwork}
      selectedCollateralToken={selectedCollateralToken}
    />
  );
};

const CollateralSelect = ({
  collateralOptions,
  marketNetwork,
  selectedCollateralToken,
}: {
  readonly collateralOptions: readonly BorrowCollateralOption[];
  readonly marketNetwork: BorrowNetwork;
  readonly selectedCollateralToken: CollateralToken;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const resolveLogo = useTokenLogoResolver();
  const selectCollateralToken = useAtomSet(selectBorrowCollateralTokenAtom);
  const [search, setSearch] = useState("");
  const logo = {
    ...useTokenLogo(
      toBorrowEntryToken({
        network: marketNetwork,
        token: selectedCollateralToken.token,
      })
    ),
    name: selectedCollateralToken.token.symbol,
  };

  if (collateralOptions.length <= 1) {
    return (
      <TokenTrigger readOnly testId="borrow-collateral-select" token={logo} />
    );
  }

  const filteredOptions = filterBorrowCollateralOptions({
    options: collateralOptions,
    search,
  });

  return (
    <SelectSheet
      testIds={{
        container: "select-modal__container",
        title: "select-modal__title",
        search: "select-modal__search-input",
      }}
      title={t("dashboard.borrow.form.select_collateral")}
      closeLabel={t("shared.close")}
      listLabel={t("dashboard.borrow.form.collateral_assets")}
      trigger={<TokenTrigger testId="borrow-collateral-select" token={logo} />}
      onOpenChange={(open) => {
        if (!open) setSearch("");
      }}
      selectedId={optionId(selectedCollateralToken)}
      onSelect={(id) => {
        const option = collateralOptions.find(
          ({ collateralToken }) => optionId(collateralToken) === id
        );
        if (option) selectCollateralToken(option.collateralToken);
      }}
      search={{
        value: search,
        onValueChange: setSearch,
        label: t("shared.search"),
        placeholder: t("dashboard.borrow.form.search_assets"),
        clearLabel: t("shared.clear_search"),
      }}
      empty={{ title: t("dashboard.borrow.form.no_assets") }}
      options={filteredOptions.map(
        ({ collateralToken, walletAmount, walletUsd }) => ({
          id: optionId(collateralToken),
          testId: `borrow-collateral-select__item_${optionId(collateralToken)}`,
          title: collateralToken.token.symbol,
          subtitle: t("dashboard.borrow.form.collateral_terms", {
            liquidationThreshold: formatPercent(
              collateralToken.liquidationThreshold,
              locale
            ),
            maxLtv: formatPercent(collateralToken.maxLtv, locale),
          }),
          ...(collateralToken.supplyRate.gte(MIN_SHOWN_SUPPLY_RATE)
            ? {
                badges: [
                  {
                    label: t("dashboard.borrow.form.collateral_earns", {
                      rate: formatPercent(collateralToken.supplyRate, locale),
                    }),
                    tone: earnsTone,
                  },
                ],
              }
            : {}),
          ...(walletAmount?.gt(0)
            ? { value: formatTokenAmount(walletAmount, locale, "down") }
            : {}),
          ...(walletUsd?.gt(0)
            ? { subvalue: formatUsd(walletUsd, locale) }
            : {}),
          logo: resolveLogo(
            toBorrowEntryToken({
              network: marketNetwork,
              token: collateralToken.token,
            })
          ),
        })
      )}
    />
  );
};
