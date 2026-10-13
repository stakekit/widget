import type BigNumber from "bignumber.js";

/** How close a projected risk figure sits to its protocol limit. */
export type RiskLevel = "safe" | "nearLimit" | "overLimit";

/** Fraction of max LTV from which an LTV is near its limit. */
const NEAR_MAX_LTV_RATIO = 0.9;
/** Health factor below which a position is near liquidation. */
const NEAR_LIQUIDATION_HEALTH_FACTOR = 1.1;
/**
 * Display prices can differ from protocol oracles, so a borrow is blocked only
 * once it is clearly past max LTV; smaller overshoots stay warnings.
 */
const BLOCKING_MAX_LTV_RATIO = 1.05;

export const classifyLtv = ({
  ltv,
  maxLtv,
}: {
  readonly ltv: BigNumber;
  readonly maxLtv: BigNumber | null;
}): RiskLevel => {
  if (ltv.gte(1) || (maxLtv && ltv.gt(maxLtv))) return "overLimit";
  if (maxLtv && ltv.gte(maxLtv.multipliedBy(NEAR_MAX_LTV_RATIO))) {
    return "nearLimit";
  }

  return "safe";
};

export const classifyHealthFactor = (healthFactor: BigNumber): RiskLevel => {
  if (healthFactor.lt(1)) return "overLimit";
  if (healthFactor.lte(NEAR_LIQUIDATION_HEALTH_FACTOR)) return "nearLimit";

  return "safe";
};

/** A projected LTV at or past 100%, or clearly past max LTV, cannot open. */
export const exceedsBorrowableLtv = ({
  ltv,
  maxLtv,
}: {
  readonly ltv: BigNumber;
  readonly maxLtv: BigNumber | null;
}) =>
  ltv.gte(1) ||
  (maxLtv !== null && ltv.gt(maxLtv.multipliedBy(BLOCKING_MAX_LTV_RATIO)));

/**
 * A projected health factor clearly below 1, by the same display-price margin
 * as `exceedsBorrowableLtv`, cannot open.
 */
export const fallsClearlyBelowLiquidation = (healthFactor: BigNumber) =>
  healthFactor.multipliedBy(BLOCKING_MAX_LTV_RATIO).lt(1);
