import type BigNumber from "bignumber.js";
import { combineRecipeWithVariant } from "../../../../../shared/styles/recipe-variant";
import { Box } from "../../../../../shared/ui/primitives/box";
import { selectTokenButton } from "../../../../../shared/ui/primitives/button/styles.css";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { useWidgetConfig } from "../../../../widget-configuration/index";
import { BorrowAmountField } from "../../../amount-input/views";

/** Position action amount card; balances carry only a symbol, not a token. */
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
}) => {
  const variant = useWidgetConfig("variant");

  return (
    <BorrowAmountField
      accessory={
        <Box
          alignItems="center"
          borderRadius="2xl"
          className={combineRecipeWithVariant({
            rec: selectTokenButton,
            variant,
          })}
          display="flex"
          px="2"
          py="1"
        >
          <Text variant={{ weight: "bold" }}>{tokenSymbol}</Text>
        </Box>
      }
      amount={amount}
      balance={balanceLabel}
      disabled={disabled}
      label={label}
      onAmountChange={onAmountChange}
      onMaxClick={onMaxClick}
      tone="action"
      usdValue={usdValue}
      warning={warning}
    />
  );
};
