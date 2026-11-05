import type BigNumber from "bignumber.js";
import { exactZero } from "../../finance/exact";

/**
 * How close a position sits to liquidation: `safe`, `caution` once a modest
 * price move would liquidate it, `danger` once a small one would. One band
 * judges the loan to value and the health factor together, so every figure
 * of a position reads the same risk.
 */
export type RiskBand = "safe" | "caution" | "danger";

/** Health factor below which a position is in caution. */
const CAUTION_HEALTH_FACTOR = 1.5;
/** Health factor below which a position is in danger. */
const DANGER_HEALTH_FACTOR = 1.1;
/** Fraction of max LTV from which an LTV is in caution. */
const CAUTION_MAX_LTV_RATIO = 0.9;

/**
 * The band of a position's risk figures, the worse of what its health factor
 * and its LTV against max LTV say. Null without debt: nothing is at risk.
 */
export const classifyRiskBand = ({
  healthFactor,
  ltv,
  maxLtv,
}: {
  readonly healthFactor: BigNumber | null;
  readonly ltv: BigNumber | null;
  readonly maxLtv: BigNumber | null;
}): RiskBand | null => {
  const hasDebt = ltv?.gt(0) === true || healthFactor !== null;
  if (!hasDebt) return null;

  if (
    healthFactor?.lt(DANGER_HEALTH_FACTOR) ||
    ltv?.gte(1) ||
    (ltv && maxLtv && ltv.gt(maxLtv))
  ) {
    return "danger";
  }
  if (
    healthFactor?.lt(CAUTION_HEALTH_FACTOR) ||
    (ltv && maxLtv && ltv.gte(maxLtv.multipliedBy(CAUTION_MAX_LTV_RATIO)))
  ) {
    return "caution";
  }

  return "safe";
};

/**
 * The share a collateral's price can fall before the position is liquidated,
 * from its health factor: at 1.25 a 20% drop liquidates it. Zero once the
 * health factor is at or below 1.
 */
export const liquidationPriceDrop = (healthFactor: BigNumber): BigNumber =>
  healthFactor.lte(1)
    ? exactZero()
    : healthFactor.minus(1).dividedBy(healthFactor);
