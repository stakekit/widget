import type BigNumber from "bignumber.js";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  amountSeparators,
  fromAmountValue,
  toAmountValue,
} from "../../../../shared/lib/amount-value";
import { formatUsd } from "../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../shared/react/widget-presentation";
import { AmountPanel } from "../../../../ui/index";
import { useWidgetConfig } from "../../../widget-configuration/index";

/** The balance an amount draws on, short and at full precision. */
export type BorrowAmountBalance = {
  readonly short: string;
  readonly full?: string;
};

/**
 * Titled amount panel for borrow forms. A warning shows under the amount as
 * its error; the form's own validation still decides whether Review can
 * start.
 */
export const BorrowAmountField = ({
  accessory,
  amount,
  balance,
  disabled = false,
  label,
  onAmountChange,
  onMaxClick,
  testId,
  usdValue,
  warning,
}: {
  readonly accessory: ReactNode;
  readonly amount: BigNumber;
  readonly balance?: BorrowAmountBalance | undefined;
  readonly disabled?: boolean | undefined;
  readonly label: string;
  readonly onAmountChange: (amount: BigNumber) => void;
  readonly onMaxClick?: (() => void) | null | undefined;
  readonly testId?: string | undefined;
  readonly usdValue?: BigNumber | undefined;
  readonly warning?: string | null | undefined;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const disableResizingInputFontSize = useWidgetConfig(
    "disableResizingInputFontSize"
  );

  return (
    <AmountPanel
      shrink={!disableResizingInputFontSize}
      label={label}
      value={toAmountValue(amount)}
      onValueChange={(value) => onAmountChange(fromAmountValue(value))}
      separators={amountSeparators(locale)}
      token={accessory}
      fiatValue={formatUsd(usdValue, locale)}
      disabled={disabled}
      testIds={{
        input: "number-input",
        max: "stake-token-section-max-button",
        ...(testId === undefined ? {} : { root: testId }),
      }}
      {...(balance === undefined ? {} : { balance })}
      {...(warning ? { error: warning } : {})}
      {...(onMaxClick
        ? { max: { label: t("shared.max"), onClick: onMaxClick } }
        : {})}
    />
  );
};
