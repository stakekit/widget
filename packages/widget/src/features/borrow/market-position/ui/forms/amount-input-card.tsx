import type BigNumber from "bignumber.js";
import { formatUsd } from "../../../../../shared/lib/formatters";
import { MaxButton } from "../../../../../shared/ui/components/max-button";
import { NumberInput } from "../../../../../shared/ui/components/number-input";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { WarningBox } from "../../../../../shared/ui/primitives/warning-box";
import * as styles from "../../../amount-input/views";

export const AmountInputCard = ({
  amount,
  balanceLabel,
  disabled,
  label,
  onAmountChange,
  onMaxClick,
  tokenSymbol,
  usdValue,
  warning,
}: {
  readonly amount: BigNumber;
  readonly balanceLabel: string;
  readonly disabled?: boolean;
  readonly label: string;
  readonly onAmountChange: (amount: BigNumber) => void;
  readonly onMaxClick?: (() => void) | null;
  readonly tokenSymbol: string;
  readonly usdValue?: BigNumber;
  readonly warning?: string | null;
}) => (
  <Box display="flex" flexDirection="column" gap="2">
    <Text variant={{ weight: "bold" }}>{label}</Text>
    <Box className={styles.amountCard}>
      <Box className={styles.amountCardHeader}>
        <NumberInput
          disabled={disabled}
          onChange={onAmountChange}
          value={amount}
        />

        <Box className={styles.amountTokenButton}>
          <Text variant={{ weight: "bold" }}>{tokenSymbol}</Text>
        </Box>
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

      {warning ? <WarningBox text={warning} /> : null}
    </Box>
  </Box>
);
