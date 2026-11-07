import type { TFunction } from "i18next";
import { classifyRiskBand } from "../../../domain/borrow/risk/risk-band";
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
import {
  type LtvMeter,
  riskBandValueTone,
  toLtvMeter,
} from "../model/risk-display";

/** One label-value row of a Borrow flow's Review or Complete summary. */
export type BorrowFlowRow = {
  readonly label: string;
  readonly value: string;
  /** A risk figure, LTV or health factor, in caution or danger after the action. */
  readonly tone?: "warning" | "danger";
  /** The LTV the action leaves, as a thin gauge under the row. */
  readonly meter?: LtvMeter;
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

/**
 * Collateral, debt, LTV, and health factor as they move with the action. The
 * LTV and health factor read in the one band of the position the action
 * leaves, and the LTV of a position with debt carries a meter of it.
 */
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
  // Whenever the position had one, even when both round alike, so a position
  // the action barely moves still reads as measured rather than unchanged.
  const healthFactor = formatFigureChange(
    formatHealthFactor,
    change.healthFactor,
    locale,
    { showWhenEqual: true }
  );
  const maxLtv = change.maxLtv ? exactDecimal(change.maxLtv) : null;
  const ltvAfter = change.ltv ? exactDecimal(change.ltv.after) : null;
  const band = classifyRiskBand({
    healthFactor: change.healthFactor
      ? exactDecimal(change.healthFactor.after)
      : null,
    ltv: ltvAfter,
    maxLtv,
  });
  const riskTone = band === null ? "default" : riskBandValueTone[band];
  const withRiskTone = (row: BorrowFlowRow): BorrowFlowRow =>
    riskTone === "default" ? row : { ...row, tone: riskTone };
  const getLtvRow = (): BorrowFlowRow | null => {
    if (!ltv || !ltvAfter) return null;
    const row = withRiskTone({
      label: t("dashboard.borrow.review_page.ltv"),
      value: ltv,
    });
    if (band === null) return row;
    return { ...row, meter: toLtvMeter({ locale, ltv: ltvAfter, maxLtv, t }) };
  };
  const ltvRow = getLtvRow();

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
    ...(ltvRow ? [ltvRow] : []),
    ...(healthFactor
      ? [
          withRiskTone({
            label: t("dashboard.borrow.review_page.health_factor"),
            value: healthFactor,
          }),
        ]
      : []),
  ];
};
