import type { TFunction } from "i18next";
import {
  classifyHealthFactor,
  classifyLtv,
  type RiskLevel,
} from "../../../domain/borrow/risk/ltv-limits";
import { exactDecimal } from "../../../domain/finance/exact";
import {
  formatFigureChange,
  formatHealthFactor,
  formatLtv,
  formatTokenAmount,
  formatUsd,
  unavailableFigure,
} from "../../../shared/lib/number-format";
import type { BorrowPositionChange } from "../model/borrow-completion";

/** One label-value row of a Borrow flow's Review or Complete summary. */
export type BorrowFlowRow = {
  readonly label: string;
  readonly value: string;
  /** A figure at risk: LTV or health factor near or over its limit. */
  readonly tone?: "warning" | "danger";
};

type Formatting = {
  readonly locale: string;
  readonly t: TFunction;
};

type SummaryAmount = {
  readonly amount: string;
  readonly symbol: string;
};

/** The collateral the action moves: rounded down, as never more than moves. */
export const getBorrowFlowCollateralAmountRow = ({
  collateral,
  locale,
  t,
}: Formatting & {
  readonly collateral: SummaryAmount;
}): BorrowFlowRow => ({
  label: t("dashboard.borrow.review_page.collateral_amount"),
  value: `${formatTokenAmount(collateral.amount, locale, "down")} ${collateral.symbol}`,
});

/**
 * What opening debt costs and the debt it opens: rounded up, as never less
 * than is owed. Null when the action opens no debt.
 */
export const getBorrowFlowOriginationRows = ({
  locale,
  origination,
  t,
}: Formatting & {
  readonly origination: {
    readonly feeAmount: string;
    readonly feeUsd: string | null;
    readonly principalAmount: string;
    readonly symbol: string;
  } | null;
}): {
  readonly fee: BorrowFlowRow;
  readonly principal: BorrowFlowRow;
} | null => {
  if (!origination) return null;

  const feeUsd = origination.feeUsd
    ? formatUsd(origination.feeUsd, locale)
    : unavailableFigure;
  const fee = `${formatTokenAmount(origination.feeAmount, locale, "up")} ${origination.symbol}`;

  return {
    fee: {
      label: t("dashboard.borrow.review_page.origination_fee"),
      value: feeUsd === unavailableFigure ? fee : `${fee} (${feeUsd})`,
    },
    principal: {
      label: t("dashboard.borrow.review_page.debt_principal"),
      value: `${formatTokenAmount(origination.principalAmount, locale, "up")} ${origination.symbol}`,
    },
  };
};

const riskLevelTone = {
  nearLimit: "warning",
  overLimit: "danger",
  safe: null,
} as const satisfies Record<RiskLevel, BorrowFlowRow["tone"] | null>;

const withRiskTone = (row: BorrowFlowRow, level: RiskLevel): BorrowFlowRow => {
  const tone = riskLevelTone[level];
  return tone ? { ...row, tone } : row;
};

/** Collateral, debt, LTV, and health factor as they move with the action. */
export const getBorrowFlowPositionChangeRows = ({
  change,
  locale,
  t,
}: Formatting & {
  readonly change: BorrowPositionChange;
}): ReadonlyArray<BorrowFlowRow> => {
  const collateral = formatFigureChange(
    formatUsd,
    change.collateralUsd,
    locale
  );
  const debt = formatFigureChange(formatUsd, change.debtUsd, locale);
  const ltv = formatFigureChange(formatLtv, change.ltv, locale);
  const healthFactor = formatFigureChange(
    formatHealthFactor,
    change.healthFactor,
    locale
  );

  return [
    ...(collateral
      ? [
          {
            label: t("dashboard.borrow.form.collateral_value"),
            value: collateral,
          },
        ]
      : []),
    ...(debt
      ? [{ label: t("dashboard.borrow.position_details.debt"), value: debt }]
      : []),
    ...(ltv && change.ltv
      ? [
          withRiskTone(
            { label: t("dashboard.borrow.review_page.ltv"), value: ltv },
            classifyLtv({
              ltv: exactDecimal(change.ltv.after),
              maxLtv: change.maxLtv ? exactDecimal(change.maxLtv) : null,
            })
          ),
        ]
      : []),
    ...(healthFactor && change.healthFactor
      ? [
          withRiskTone(
            {
              label: t("dashboard.borrow.review_page.health_factor"),
              value: healthFactor,
            },
            classifyHealthFactor(exactDecimal(change.healthFactor.after))
          ),
        ]
      : []),
  ];
};
