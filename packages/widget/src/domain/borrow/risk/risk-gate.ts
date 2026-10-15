import type BigNumber from "bignumber.js";
import type { RiskAssessment } from "./risk-model";

/** The Borrow Constraint Warning the Risk Gate raises. */
export type RiskGateWarning = "RiskCapacityExceeded";

/** The protocol limit a blocked change would cross. */
export type RiskGateBlockReason = "healthFactor" | "ltv";

/** The Risk Gate's decision on a proposed Borrow change. */
export type RiskGateVerdict =
  | { readonly _tag: "Allow" }
  | {
      readonly _tag: "Warn";
      readonly warnings: ReadonlyArray<RiskGateWarning>;
    }
  | { readonly _tag: "Block"; readonly reason: RiskGateBlockReason };

/**
 * Display prices can differ from protocol oracles, so a display-priced
 * projection blocks only once it is clearly past a limit.
 */
const DISPLAY_PRICE_TOLERANCE = 1.05;

const blockReason = ({
  healthFactor,
  ltv,
  maxLtv,
  tolerance,
}: {
  readonly healthFactor: BigNumber | null;
  readonly ltv: BigNumber;
  readonly maxLtv: BigNumber | null;
  readonly tolerance: number;
}): RiskGateBlockReason | null => {
  if (healthFactor?.multipliedBy(tolerance).lt(1)) return "healthFactor";
  if (maxLtv?.multipliedBy(tolerance).lt(ltv)) return "ltv";
  return null;
};

/**
 * The Risk Gate: the single allow, warn, or block decision for a proposed
 * Borrow change.
 *
 * - Only risk-increasing changes are warned about or blocked.
 * - Oracle-anchored projections block exactly at protocol limits: LTV above
 *   max LTV (the liquidation threshold) or health factor below 1.
 * - Display-priced projections block at LTV 1, past max LTV × 1.05, or at a
 *   health factor whose × 1.05 is below 1; smaller overshoots warn.
 * - Exceeding borrow capacity without blocking warns.
 * - Risk Unavailable allows; the capacity warning still applies.
 */
export const assessRiskGate = ({
  capacity,
  pricing,
  projection,
  riskIncreasing,
}: RiskAssessment): RiskGateVerdict => {
  if (!riskIncreasing) return { _tag: "Allow" };

  if (projection.status === "available") {
    const reason =
      blockReason({
        ...projection,
        tolerance: pricing === "oracle" ? 1 : DISPLAY_PRICE_TOLERANCE,
      }) ?? (pricing === "display" && projection.ltv.gte(1) ? "ltv" : null);
    if (reason) return { _tag: "Block", reason };
  }

  const overshoots =
    capacity === "exceedsCapacity" ||
    (projection.status === "available" &&
      blockReason({ ...projection, tolerance: 1 }) !== null);

  return overshoots
    ? { _tag: "Warn", warnings: ["RiskCapacityExceeded"] }
    : { _tag: "Allow" };
};
