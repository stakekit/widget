import type BigNumber from "bignumber.js";
import type { ReactElement, ReactNode } from "react";
import { formatUsd } from "../../../../shared/lib/formatters";
import { MaxButton } from "../../../../shared/ui/components/max-button";
import { Box } from "../../../../shared/ui/primitives/box";
import { Text } from "../../../../shared/ui/primitives/typography/text";
import * as styles from "./styles.css";

export const BorrowAmountCardFooter = ({
  balanceLabel,
  onMaxClick,
  usdValue,
}: {
  readonly balanceLabel: ReactNode;
  readonly onMaxClick?: (() => void) | null;
  readonly usdValue?: BigNumber;
}): ReactElement => (
  <Box className={styles.amountCardFooter}>
    <Text variant={{ type: "muted", weight: "normal" }}>
      {formatUsd(usdValue)}
    </Text>
    <Box className={styles.amountBalanceGroup}>
      <Text variant={{ type: "muted", weight: "normal" }}>{balanceLabel}</Text>
      {onMaxClick ? <MaxButton onMaxClick={onMaxClick} /> : null}
    </Box>
  </Box>
);
