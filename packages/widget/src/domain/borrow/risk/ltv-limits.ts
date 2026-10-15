import type BigNumber from "bignumber.js";

/** How close a projected risk figure sits to its protocol limit. */
export type RiskLevel = "safe" | "nearLimit" | "overLimit";

/** Fraction of max LTV from which an LTV is near its limit. */
const NEAR_MAX_LTV_RATIO = 0.9;
/** Health factor below which a position is near liquidation. */
const NEAR_LIQUIDATION_HEALTH_FACTOR = 1.1;

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
