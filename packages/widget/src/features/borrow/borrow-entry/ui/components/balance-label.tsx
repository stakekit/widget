import type BigNumber from "bignumber.js";
import { useTranslation } from "react-i18next";
import {
  formatNumber,
  formatTokenAmount,
} from "../../../../../shared/lib/number-format";
import * as AmountToggle from "../../../../../shared/ui/components/amount-toggle";
import { useWidgetPresentation } from "../../../../../shared/ui/widget-presentation";

export const BorrowBalanceLabel = ({
  amount,
  symbol,
}: {
  readonly amount: string | number | BigNumber;
  readonly symbol: string;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();

  return (
    <AmountToggle.Root>
      <AmountToggle.Amount>
        {({ state }) =>
          t("dashboard.borrow.form.wallet_balance", {
            amount:
              state === "full"
                ? formatNumber(amount, locale)
                : formatTokenAmount(amount, locale),
            symbol,
          })
        }
      </AmountToggle.Amount>
    </AmountToggle.Root>
  );
};
