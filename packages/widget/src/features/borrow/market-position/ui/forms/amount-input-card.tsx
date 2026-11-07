import type BigNumber from "bignumber.js";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { TokenTrigger } from "../../../../../ui/index";
import { BorrowAmountField } from "../../../amount-input/views";

/**
 * Position action amount panel; balances carry only a symbol, not a token, so
 * the accessory shows the symbol unless the form supplies a token selector.
 * The field is labelled Amount: the pressed action button above names the
 * verb.
 */
export const AmountInputCard = ({
  amount,
  balanceLabel,
  disabled,
  focusRequest,
  onAmountChange,
  onMaxClick,
  tokenSelector,
  tokenSymbol,
  usdValue,
  warning,
}: {
  readonly amount: BigNumber;
  readonly balanceLabel: string;
  readonly disabled?: boolean;
  /** Each new value above zero focuses the amount. */
  readonly focusRequest?: number;
  readonly onAmountChange: (amount: BigNumber) => void;
  readonly onMaxClick?: (() => void) | null;
  readonly tokenSelector?: ReactNode;
  readonly tokenSymbol: string;
  readonly usdValue?: BigNumber;
  readonly warning?: string | null;
}) => {
  const { t } = useTranslation();

  return (
    <BorrowAmountField
      accessory={
        tokenSelector ?? <TokenTrigger readOnly token={{ name: tokenSymbol }} />
      }
      amount={amount}
      balance={{ short: balanceLabel }}
      disabled={disabled}
      {...(focusRequest === undefined ? {} : { focusRequest })}
      label={t("shared.amount")}
      onAmountChange={onAmountChange}
      onMaxClick={onMaxClick}
      usdValue={usdValue}
      warning={warning}
    />
  );
};
