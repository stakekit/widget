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

/**
 * Oracle-anchored projections rest on a snapshot that may be a minute old and
 * whose LTV is rounded, so they block only once past a limit by this margin.
 */
const ORACLE_SNAPSHOT_TOLERANCE = 1.001;

const blockReason = ({
  addsDebt,
  healthFactor,
  ltv,
  maxLtv,
  tolerance,
}: {
  readonly addsDebt: boolean;
  readonly healthFactor: BigNumber | null;
  readonly ltv: BigNumber;
  readonly maxLtv: BigNumber | null;
  readonly tolerance: number;
}): RiskGateBlockReason | null => {
  if (healthFactor?.multipliedBy(tolerance).lt(1)) return "healthFactor";
  if (addsDebt && maxLtv?.multipliedBy(tolerance).lt(ltv)) return "ltv";
  return null;
};

/**
 * The Risk Gate: the single allow, warn, or block decision for a proposed
 * Borrow change. It blocks only changes it is sure the protocol rejects.
 *
 * - Only risk-increasing changes are warned about or blocked.
 * - The health factor bounds every change. Max LTV bounds only changes that
 *   add debt: protocols check it on borrow, not on collateral removal.
 * - Oracle-anchored projections block past the limit by 0.1%; display-priced
 *   ones past max LTV × 1.05, at LTV 1 when adding debt, or at a health
 *   factor whose × 1.05 is below 1. Smaller overshoots warn.
 * - Exceeding borrow capacity without blocking warns.
 * - Risk Unavailable allows; the capacity warning still applies.
 */
export const assessRiskGate = ({
  addsDebt,
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
        addsDebt,
        tolerance:
          pricing === "oracle"
            ? ORACLE_SNAPSHOT_TOLERANCE
            : DISPLAY_PRICE_TOLERANCE,
      }) ??
      (pricing === "display" && addsDebt && projection.ltv.gte(1)
        ? "ltv"
        : null);
    if (reason) return { _tag: "Block", reason };
  }

  const overshoots =
    capacity === "exceedsCapacity" ||
    (projection.status === "available" &&
      blockReason({ ...projection, addsDebt: true, tolerance: 1 }) !== null);

  return overshoots
    ? { _tag: "Warn", warnings: ["RiskCapacityExceeded"] }
    : { _tag: "Allow" };
};
