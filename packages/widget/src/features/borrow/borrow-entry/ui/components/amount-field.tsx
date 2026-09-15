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
import * as inputStyles from "../../../../../shared/ui/components/number-input/styles.css";
import { Box } from "../../../../../shared/ui/primitives/box";
import { ContentLoaderLine } from "../../../../../shared/ui/primitives/content-loader";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { WarningBox } from "../../../../../shared/ui/primitives/warning-box";
import * as styles from "../../../amount-input/views";
import { StaticAmountTokenButton } from "./asset-selector";

export const AmountField = (
  props: {
    readonly highlight?: boolean;
    readonly label: string;
  } & (
    | { readonly loading: true; readonly showBalance?: boolean }
    | {
        readonly loading?: false;
        readonly amount: BigNumber;
        readonly balanceLabel: ReactNode;
        readonly onMaxClick: (() => void) | null;
        readonly onAmountChange: (amount: BigNumber) => void;
        readonly tokenSelector: ReactNode;
        readonly usdValue: BigNumber;
        readonly warningText?: string | null;
      }
  )
) => (
  <Box aria-busy={props.loading} display="flex" flexDirection="column" gap="4">
    <Text variant={{ weight: "bold" }}>{props.label}</Text>
    <Box
      className={clsx(
        styles.amountCard,
        props.highlight && styles.amountCardHighlighted
      )}
      data-rk="borrow-amount-section"
    >
      <Box className={styles.amountCardHeader}>
        {props.loading ? (
          <Box className={inputStyles.container}>
            <Text
              className={inputStyles.numberInput}
              variant={{ weight: "normal" }}
            >
              <ContentLoaderLine widthPx="3ch" />
            </Text>
          </Box>
        ) : (
          <NumberInput onChange={props.onAmountChange} value={props.amount} />
        )}
        {props.loading ? (
          <StaticAmountTokenButton token={null} />
        ) : (
          props.tokenSelector
        )}
      </Box>

      <Box className={styles.amountCardFooter}>
        <Text variant={{ type: "muted", weight: "normal" }}>
          {props.loading ? (
            <ContentLoaderLine widthPx="7ch" />
          ) : (
            formatUsd(props.usdValue)
          )}
        </Text>
        <Box className={styles.amountBalanceGroup}>
          <Text variant={{ type: "muted", weight: "normal" }}>
            {props.loading
              ? props.showBalance && <BorrowBalanceLabel loading />
              : props.balanceLabel}
          </Text>
          {!props.loading && props.onMaxClick ? (
            <MaxButton onMaxClick={props.onMaxClick} />
          ) : null}
        </Box>
      </Box>
      {!props.loading && props.warningText ? (
        <WarningBox text={props.warningText} />
      ) : null}
    </Box>
  </Box>
);

export const BorrowBalanceLabel = (
  props:
    | { readonly loading: true }
    | {
        readonly loading?: false;
        readonly amount: string | number | BigNumber;
        readonly symbol: string;
      }
) => {
  const { t } = useTranslation();

  if (props.loading) {
    return <ContentLoaderLine widthPx="14ch" />;
  }

  const { amount, symbol } = props;

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
