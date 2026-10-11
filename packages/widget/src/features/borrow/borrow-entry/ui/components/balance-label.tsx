import type BigNumber from "bignumber.js";
import { useTranslation } from "react-i18next";
import {
  defaultFormattedNumber,
  formatNumber,
} from "../../../../../shared/lib/number-format";
import * as AmountToggle from "../../../../../shared/ui/components/amount-toggle";

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
