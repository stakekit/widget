import type BigNumber from "bignumber.js";
import clsx from "clsx";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { formatUsd } from "../../../../../shared/lib/formatters";
import {
  defaultFormattedNumber,
  formatNumber,
} from "../../../../../shared/lib/number-format";
import * as AmountToggle from "../../../../../shared/ui/components/amount-toggle";
import { MaxButton } from "../../../../../shared/ui/components/max-button";
import { NumberInput } from "../../../../../shared/ui/components/number-input";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { WarningBox } from "../../../../../shared/ui/primitives/warning-box";
import * as styles from "../../../amount-input/views";

export const AmountField = ({
  amount,
  balanceLabel,
  highlight = false,
  label,
  onMaxClick,
  onAmountChange,
  tokenSelector,
  usdValue,
  warningText,
}: {
  readonly amount: BigNumber;
  readonly balanceLabel: ReactNode;
  readonly highlight?: boolean;
  readonly label: string;
  readonly onMaxClick: (() => void) | null;
  readonly onAmountChange: (amount: BigNumber) => void;
  readonly tokenSelector: ReactNode;
  readonly usdValue: BigNumber;
  readonly warningText?: string | null;
}) => (
  <Box display="flex" flexDirection="column" gap="4">
    <Text variant={{ weight: "bold" }}>{label}</Text>
    <Box
      className={clsx(
        styles.amountCard,
        highlight && styles.amountCardHighlighted
      )}
      data-rk="borrow-amount-section"
    >
      <Box className={styles.amountCardHeader}>
        <NumberInput onChange={onAmountChange} value={amount} />

        {tokenSelector}
      </Box>

      <Box className={styles.amountCardFooter}>
        <Text variant={{ type: "muted", weight: "normal" }}>
          {formatUsd(usdValue)}
        </Text>
        <Box className={styles.amountBalanceGroup}>
          <Text variant={{ type: "muted", weight: "normal" }}>
            {balanceLabel}
          </Text>
          {onMaxClick ? <MaxButton onMaxClick={onMaxClick} /> : null}
        </Box>
      </Box>
      {warningText ? <WarningBox text={warningText} /> : null}
    </Box>
  </Box>
);

export const BorrowBalanceLabel = ({
  amount,
  symbol,
}: {
  readonly amount: string | number | BigNumber;
  readonly symbol: string;
}) => {
  const { t } = useTranslation();

  return (
    <AmountToggle.Root>
      <AmountToggle.Amount>
        {({ state }) =>
          t("dashboard.borrow.form.wallet_balance", {
            amount:
              state === "full"
                ? formatNumber(amount)
                : defaultFormattedNumber(amount),
            symbol,
          })
        }
      </AmountToggle.Amount>
    </AmountToggle.Root>
  );
};
