import type BigNumber from "bignumber.js";
import type { ReactNode } from "react";
import { formatUsd } from "../../../../shared/lib/formatters";
import { combineRecipeWithVariant } from "../../../../shared/styles/recipe-variant";
import {
  AmountTokenSection,
  AmountTokenSectionTitle,
} from "../../../../shared/ui/components/amount-token-section";
import { amountTokenSectionTitleContainer } from "../../../../shared/ui/components/amount-token-section/styles.css";
import { Box } from "../../../../shared/ui/primitives/box";
import { useWidgetConfig } from "../../../widget-configuration/index";

/**
 * Titled amount card for borrow forms. Renders the same amount card as earn;
 * a warning marks the input invalid and shows below it like earn's limits.
 */
export const BorrowAmountField = ({
  accessory,
  amount,
  balance,
  balanceError = false,
  dataRk,
  disabled,
  label,
  onAmountChange,
  onMaxClick,
  tone = "stake",
  usdValue,
  warning,
}: {
  readonly accessory: ReactNode;
  readonly amount: BigNumber;
  readonly balance?: ReactNode;
  readonly balanceError?: boolean;
  readonly dataRk?: string;
  readonly disabled?: boolean;
  readonly label: string;
  readonly onAmountChange: (amount: BigNumber) => void;
  readonly onMaxClick?: (() => void) | null;
  readonly tone?: "stake" | "action";
  readonly usdValue?: BigNumber;
  readonly warning?: string | null;
}) => {
  const variant = useWidgetConfig("variant");

  return (
    <Box>
      <Box
        className={combineRecipeWithVariant({
          rec: amountTokenSectionTitleContainer,
          variant,
        })}
      >
        <AmountTokenSectionTitle>{label}</AmountTokenSectionTitle>
      </Box>

      <AmountTokenSection
        value={amount}
        onChange={onAmountChange}
        disabled={disabled}
        isInvalid={!!warning}
        accessory={accessory}
        formattedPrice={formatUsd(usdValue)}
        balance={balance}
        balanceError={balanceError}
        onMaxClick={onMaxClick}
        maxButtonProps={
          tone === "action" ? { background: "backgroundMuted" } : undefined
        }
        minMaxLabel={warning}
        minMaxError
        tone={tone}
        dataRk={dataRk}
      />
    </Box>
  );
};
