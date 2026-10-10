import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import {
  formatBorrowProviderName,
  formatNetworkName,
  formatUsd,
} from "../../../shared/lib/formatters";
import { DetailRow } from "../../../shared/ui/components/details-section";
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

  return (
    <>
      {projected.borrow ? (
        <DetailRow
          id="borrow-amount"
          label={t(getBorrowTransactionFlowAmountLabelKey(action))}
          value={`${projected.borrow.amount} ${projected.borrow.symbol}`}
        />
      ) : null}
      {projected.collateral ? (
        <DetailRow
          id="collateral-amount"
          label={t("dashboard.borrow.review_page.collateral_amount")}
          value={`${projected.collateral.amount} ${projected.collateral.symbol}`}
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

  if (!origination) return null;

  const feeUsd = origination.feeUsd ? formatUsd(origination.feeUsd) : "-";
  const fee = `${origination.feeAmount} ${origination.symbol}`;

  return (
    <>
      <DetailRow
        id="origination-fee"
        label={t("dashboard.borrow.review_page.origination_fee")}
        value={feeUsd === "-" ? fee : `${fee} (${feeUsd})`}
      />
      <DetailRow
        id="debt-principal"
        label={t("dashboard.borrow.review_page.debt_principal")}
        value={`${origination.principalAmount} ${origination.symbol}`}
      />
    </>
  );
};

export const BorrowFlowMarketRows = ({
  summary,
}: {
  readonly summary: Pick<
    BorrowTransactionFlowReview["summary"],
    "marketLabel" | "providerName" | "network"
  >;
}): ReactElement => {
  const { t } = useTranslation();

  return (
    <>
      <DetailRow
        id="market"
        label={t("dashboard.borrow.review_page.market")}
        value={summary.marketLabel}
      />
      <DetailRow
        id="provider"
        label={t("dashboard.borrow.review_page.provider")}
        value={formatBorrowProviderName(summary.providerName)}
      />
      <DetailRow
        id="network"
        label={t("dashboard.borrow.review_page.network")}
        value={formatNetworkName(summary.network)}
      />
    </>
  );
};
