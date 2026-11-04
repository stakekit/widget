import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import {
  formatTokenAmount,
  formatUsd,
} from "../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../shared/react/widget-presentation";
import { DetailRow } from "../../../ui/index";
import {
  type BorrowTransactionFlowReview,
  getBorrowTransactionFlowAmountLabelKey,
} from "../model/borrow-transaction-flow";

type SummaryAmount = {
  readonly amount: string;
  readonly symbol: string;
};

export const BorrowFlowAmountRows = ({
  action,
  projected,
}: {
  readonly action: BorrowTransactionFlowReview["summary"]["action"];
  readonly projected: {
    readonly borrow: SummaryAmount | null;
    readonly collateral: SummaryAmount | null;
  };
}): ReactElement => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();

  return (
    <>
      {projected.borrow ? (
        <DetailRow
          label={t(getBorrowTransactionFlowAmountLabelKey(action))}
          value={`${formatTokenAmount(projected.borrow.amount, locale, "down")} ${projected.borrow.symbol}`}
        />
      ) : null}
      {projected.collateral ? (
        <DetailRow
          label={t("dashboard.borrow.review_page.collateral_amount")}
          value={`${formatTokenAmount(projected.collateral.amount, locale, "down")} ${projected.collateral.symbol}`}
        />
      ) : null}
    </>
  );
};

export const BorrowFlowOriginationRows = ({
  origination,
}: {
  readonly origination: {
    readonly feeAmount: string;
    readonly feeUsd: string | null;
    readonly principalAmount: string;
    readonly symbol: string;
  } | null;
}): ReactElement | null => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();

  if (!origination) return null;

  const feeUsd = origination.feeUsd
    ? formatUsd(origination.feeUsd, locale)
    : "-";
  const fee = `${formatTokenAmount(origination.feeAmount, locale, "up")} ${origination.symbol}`;

  return (
    <>
      <DetailRow
        label={t("dashboard.borrow.review_page.origination_fee")}
        value={feeUsd === "-" ? fee : `${fee} (${feeUsd})`}
      />
      <DetailRow
        label={t("dashboard.borrow.review_page.debt_principal")}
        value={`${formatTokenAmount(origination.principalAmount, locale, "up")} ${origination.symbol}`}
      />
    </>
  );
};
