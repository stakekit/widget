import type BigNumber from "bignumber.js";
import clsx from "clsx";
import { formatUsd } from "../../../../../shared/lib/formatters";
import { MaxButton } from "../../../../../shared/ui/components/max-button";
import { NumberInput } from "../../../../../shared/ui/components/number-input";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import * as styles from "../../../amount-input/ui/styles.css";

export const AmountInputCard = ({
  amount,
  balanceLabel,
  disabled,
  error,
  label,
  onAmountChange,
  onMaxClick,
  tokenSymbol,
  usdValue,
}: {
  readonly amount: BigNumber;
  readonly balanceLabel: string;
  readonly disabled?: boolean;
  readonly error?: string | null;
  readonly label: string;
  readonly onAmountChange: (amount: BigNumber) => void;
  readonly onMaxClick?: (() => void) | null;
  readonly tokenSymbol: string;
  readonly usdValue?: BigNumber;
}) => (
  <Box display="flex" flexDirection="column" gap="2">
    <Text variant={{ weight: "bold" }}>{label}</Text>
    <Box className={clsx(styles.amountCard, error && styles.amountCardInvalid)}>
      <Box className={styles.amountCardHeader}>
        <NumberInput
          disabled={disabled}
          isInvalid={!!error}
          onChange={onAmountChange}
          shakeOnInvalid
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

      {error ? (
        <Text variant={{ type: "danger", weight: "normal" }}>{error}</Text>
      ) : null}
    </Box>
  </Box>
);
