import { useTranslation } from "react-i18next";
import { type Token, tokenString } from "../../../../../domain/token/token";
import {
  formatTokenAmount,
  formatUsd,
} from "../../../../../shared/lib/number-format";
import {
  useTokenLogo,
  useTokenLogoResolver,
} from "../../../../../shared/react/token-logo";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import { SelectSheet, TokenTrigger } from "../../../../../ui/index";
import { useTrackEvent } from "../../../../tracking/index";
import {
  useEarnEntry,
  useEarnTokenSelection,
} from "../../../react/use-earn-facades";
import type { EarnTokenSelectionItem } from "../../../state/token-selection";

/** The entry token beside the amount, and the sheet to choose another. */
export const SelectToken = ({ canSelect = true }: { canSelect?: boolean }) => {
  const { view: entry } = useEarnEntry();

  if (!entry.selectedToken) return null;

  return <SelectTokenSheet canSelect={canSelect} token={entry.selectedToken} />;
};

const SelectTokenSheet = ({
  canSelect,
  token,
}: {
  readonly canSelect: boolean;
  readonly token: Token;
}) => {
  const { select, setSearch, view } = useEarnTokenSelection();
  const trackEvent = useTrackEvent();
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const resolveLogo = useTokenLogoResolver();
  const logo = { ...useTokenLogo(token), name: token.symbol };

  if (!canSelect) {
    return <TokenTrigger token={logo} readOnly testId="select-token" />;
  }

  const items = new Map<string, EarnTokenSelectionItem>(
    view.filtered.map((item) => [tokenString(item.token), item])
  );

  return (
    <SelectSheet
      title={t("select_token.title")}
      closeLabel={t("shared.close")}
      listLabel={t("select_token.title")}
      trigger={<TokenTrigger token={logo} testId="select-token" />}
      onOpenChange={(open) => {
        if (open) trackEvent("selectTokenModalOpened");
        else setSearch("");
      }}
      search={{
        value: view.search,
        onValueChange: setSearch,
        label: t("shared.search"),
        clearLabel: t("shared.clear_search"),
      }}
      empty={{ title: t("select_token.no_results") }}
      options={view.filtered.map((item) => {
        const yieldsCount = t("select_token.yields_count", {
          count: item.availableYields.length,
        });

        return {
          id: tokenString(item.token),
          title: item.token.symbol,
          subtitle: item.token.name,
          logo: resolveLogo(item.token),
          ...(item.fundedAmount
            ? { value: formatTokenAmount(item.fundedAmount, locale, "down") }
            : {}),
          subvalue: item.fundedUsd
            ? `${formatUsd(item.fundedUsd, locale)} · ${yieldsCount}`
            : yieldsCount,
        };
      })}
      selectedId={tokenString(token)}
      onSelect={(id) => {
        const item = items.get(id);
        if (item) select(item);
      }}
      testIds={{
        container: "select-modal__container",
        title: "select-modal__title",
        search: "select-modal__search-input",
      }}
    />
  );
};
