import type { Market } from "../../../domain/borrow/catalog/market";
import type { ActionMetadata } from "../../../domain/borrow/execution/action";
import type { MarketId } from "../../../domain/borrow/ids";
import type { BorrowPositions } from "../../../domain/borrow/positions/borrow-positions";
import { exactDecimal, exactZero } from "../../../domain/finance/exact";
import {
  type BorrowTransactionFlowReview,
  type ProjectedBorrowTransactionFlowSummary as ProjectedSummary,
  projectBorrowTransactionFlowSummary,
} from "./borrow-transaction-flow";

type Summary = BorrowTransactionFlowReview["summary"];

/** A position figure before the action and after it. */
type FigureChange = {
  readonly after: string;
  readonly before: string | null;
};

export type BorrowPositionChange = {
  readonly collateralUsd: FigureChange | null;
  readonly debtUsd: FigureChange | null;
  readonly healthFactor: FigureChange | null;
  readonly ltv: FigureChange | null;
  readonly maxLtv: string | null;
};

/** The position as the Borrow API reports it after the action. */
export type BorrowSettledPosition = {
  readonly collateralUsd: string | null;
  readonly debtUsd: string | null;
  readonly healthFactor: string | null;
  readonly ltv: string | null;
  readonly maxLtv: string | null;
  /** Whether the position the flow returns to still has balances. */
  readonly positionOpen: boolean;
};

/**
 * Settles figures in the scope Review projected them: the market's risk
 * position, which for a pooled market is the whole account, so a collateral
 * reserve settles even though its supply shows under the debt it backs.
 * Repayment is the exception: Review projects the repaid reserve's own debt.
 * An unknown market has nothing to settle.
 */
export const settleBorrowPosition = ({
  action,
  marketId,
  markets,
  positionMarketId,
  positions,
}: {
  readonly action: Summary["action"];
  readonly marketId: MarketId;
  readonly markets: ReadonlyArray<Market>;
  /** The position page's market; a pool collateral action targets another. */
  readonly positionMarketId: MarketId;
  readonly positions: BorrowPositions;
}): BorrowSettledPosition | null => {
  const market = markets.find((candidate) => candidate.id === marketId);
  if (!market) return null;

  const risk = positions.riskFor(market).current;
  const available = risk.status === "available" ? risk : null;
  const reserveDebtUsd =
    positions.items.find((position) => position.id === marketId)?.balances.debt
      ?.balanceUsd ?? exactZero();
  const debtUsd = action === "repay" ? reserveDebtUsd : risk.totalDebtUsd;

  return {
    collateralUsd: risk.totalCollateralUsd?.toString(10) ?? null,
    debtUsd: debtUsd?.toString(10) ?? null,
    healthFactor: available?.healthFactor?.toString(10) ?? null,
    ltv: available?.ltv.toString(10) ?? null,
    maxLtv: available?.maxLtv?.toString(10) ?? null,
    positionOpen: positions.items.some(
      (position) => position.id === positionMarketId
    ),
  };
};

const change = (
  before: string | null,
  after: string | null
): FigureChange | null => (after === null ? null : { after, before });

/** The figures Review projected the action to leave. */
export const estimateBorrowPositionChange = ({
  financials,
  risk,
}: ProjectedSummary): BorrowPositionChange => ({
  collateralUsd: change(
    financials.existingCollateralUsd,
    financials.projectedCollateralUsd
  ),
  debtUsd: change(financials.existingDebtUsd, financials.projectedDebtUsd),
  healthFactor: change(risk.currentHealthFactor, risk.projectedHealthFactor),
  ltv: change(risk.currentLtv, risk.projectedLtv),
  maxLtv: risk.maxLtv,
});

const settledPositionChange = (
  { financials, risk }: ProjectedSummary,
  settled: BorrowSettledPosition
): BorrowPositionChange => ({
  collateralUsd: change(
    financials.existingCollateralUsd,
    settled.collateralUsd
  ),
  debtUsd: change(financials.existingDebtUsd, settled.debtUsd),
  healthFactor: change(risk.currentHealthFactor, settled.healthFactor),
  ltv: change(risk.currentLtv, settled.ltv),
  maxLtv: settled.maxLtv ?? risk.maxLtv,
});

const isZero = (value: string | null) =>
  value !== null && exactDecimal(value).isZero();

/** A figure that was and stays zero says nothing about this action. */
const withoutStaticZero = (figure: FigureChange | null) =>
  figure &&
  isZero(figure.after) &&
  (figure.before === null || isZero(figure.before))
    ? null
    : figure;

const withoutStaticZeros = (
  position: BorrowPositionChange
): BorrowPositionChange => ({
  collateralUsd: withoutStaticZero(position.collateralUsd),
  debtUsd: withoutStaticZero(position.debtUsd),
  healthFactor: withoutStaticZero(position.healthFactor),
  ltv: withoutStaticZero(position.ltv),
  maxLtv: position.maxLtv,
});

const getHeadline = (summary: Summary, projected: ProjectedSummary) => {
  switch (summary.action) {
    case "borrow":
    case "borrowAndSupply":
    case "repay":
    case "supply":
    case "withdraw": {
      const amount = projected.borrow ?? projected.collateral;
      return {
        amount: amount?.amount ?? null,
        symbol: amount?.symbol ?? "",
      };
    }
    case "disableCollateral":
    case "enableCollateral":
      return { amount: null, symbol: summary.collateralTokenSymbol };
  }
};

const getCollateralFee = (projected: ProjectedSummary) => {
  const collateral = projected.collateral;
  if (!collateral || !("feeAmount" in collateral)) return null;
  if (!exactDecimal(collateral.feeAmount).isGreaterThan(0)) return null;

  return { amount: collateral.feeAmount, symbol: collateral.symbol };
};

/**
 * What a completed action did and the position it left. The settled position,
 * once the Borrow API reports it, replaces Review's estimate; until then the
 * estimate stands in.
 */
export const projectBorrowCompletion = ({
  metadata,
  settled,
  summary,
}: {
  readonly metadata?: ActionMetadata;
  readonly settled?: BorrowSettledPosition | null;
  readonly summary: Summary;
}) => {
  const projected = projectBorrowTransactionFlowSummary(summary, metadata);

  return {
    details: {
      collateralFee: getCollateralFee(projected),
      collateralSupplied:
        summary.action === "borrowAndSupply" && projected.collateral
          ? {
              amount: projected.collateral.amount,
              symbol: projected.collateral.symbol,
            }
          : null,
      origination: projected.origination,
    },
    headline: getHeadline(summary, projected),
    position: settled
      ? {
          change: withoutStaticZeros(settledPositionChange(projected, settled)),
          source: "settled" as const,
        }
      : {
          change: withoutStaticZeros(estimateBorrowPositionChange(projected)),
          source: "estimated" as const,
        },
  };
};
