import { useTranslation } from "react-i18next";

import { type Token, tokenString } from "../../../../../domain/token/token";
import { formatTokenAmount } from "../../../../../shared/lib/number-format";
import {
  useTokenLogo,
  useTokenLogoResolver,
} from "../../../../../shared/react/token-logo";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import { SelectSheet, TokenTrigger } from "../../../../../ui/index";
import type { PositionEnterTokenOption } from "../../../model/enter-token";

const triggerTestId = "position-details-stake-token";

/** The token a position is entered with, chosen among those it accepts. */
export const PositionDetailsEnterTokenSelect = ({
  onSelect,
  options,
  selectable,
  token,
}: {
  readonly onSelect: (token: Token) => void;
  readonly options: ReadonlyArray<PositionEnterTokenOption>;
  readonly selectable: boolean;
  readonly token: Token;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const resolveLogo = useTokenLogoResolver();
  const trigger = { ...useTokenLogo(token), name: token.symbol };

  if (!selectable) return <TokenTrigger token={trigger} readOnly />;

  const selected = options.find((option) => option.selected);

  return (
    <SelectSheet
      title={t("select_token.title")}
      closeLabel={t("shared.close")}
      listLabel={t("select_token.title")}
      trigger={<TokenTrigger token={trigger} testId={triggerTestId} />}
      options={options.map((option) => ({
        id: tokenString(option.token),
        title: option.token.symbol,
        subtitle: option.token.name,
        logo: { ...resolveLogo(option.token), name: option.token.symbol },
        testId: `${triggerTestId}-${option.token.symbol}`,
        ...(option.amount?.isGreaterThan(0)
          ? { value: formatTokenAmount(option.amount, locale, "down") }
          : {}),
      }))}
      {...(selected ? { selectedId: tokenString(selected.token) } : {})}
      onSelect={(id) => {
        const option = options.find(
          (candidate) => tokenString(candidate.token) === id
        );
        if (option) onSelect(option.token);
      }}
      testIds={{
        container: "select-modal__container",
        title: "select-modal__title",
      }}
    />
  );
};
