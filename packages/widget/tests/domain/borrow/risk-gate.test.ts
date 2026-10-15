import BigNumber from "bignumber.js";
import { describe, expect, it } from "vitest";
import {
  assessRiskGate,
  type RiskGateVerdict,
} from "../../../src/domain/borrow/risk/risk-gate";
import type {
  RiskAssessment,
  RiskProjection,
} from "../../../src/domain/borrow/risk/risk-model";

const available = ({
  healthFactor,
  ltv,
  maxLtv,
}: {
  readonly healthFactor: string | null;
  readonly ltv: string;
  readonly maxLtv: string | null;
}): RiskProjection => ({
  borrowCapacityUsd: new BigNumber(0),
  healthFactor: healthFactor === null ? null : new BigNumber(healthFactor),
  liquidationCapacityUsd: new BigNumber(0),
  liquidationThreshold: null,
  ltv: new BigNumber(ltv),
  maxLtv: maxLtv === null ? null : new BigNumber(maxLtv),
  status: "available",
  totalCollateralUsd: new BigNumber(0),
  totalDebtUsd: new BigNumber(0),
});

const riskUnavailable: RiskProjection = {
  reason: "missingRiskAnchor",
  status: "unavailable",
  totalCollateralUsd: null,
  totalDebtUsd: null,
};

const allow = { _tag: "Allow" } as const;
const warn = { _tag: "Warn", warnings: ["RiskCapacityExceeded"] } as const;
const blockLtv = { _tag: "Block", reason: "ltv" } as const;
const blockHealthFactor = { _tag: "Block", reason: "healthFactor" } as const;

describe("Risk Gate", () => {
  it.each<{
    readonly case: string;
    readonly assessment: RiskAssessment;
    readonly verdict: RiskGateVerdict;
  }>([
    // Oracle-anchored projections block exactly at protocol limits.
    {
      assessment: {
        capacity: "withinCapacity",
        pricing: "oracle",
        projection: available({
          healthFactor: "1",
          ltv: "0.86",
          maxLtv: "0.86",
        }),
        riskIncreasing: true,
      },
      case: "oracle at max LTV and health factor 1",
      verdict: allow,
    },
    {
      assessment: {
        capacity: "exceedsCapacity",
        pricing: "oracle",
        projection: available({
          healthFactor: null,
          ltv: "0.8601",
          maxLtv: "0.86",
        }),
        riskIncreasing: true,
      },
      case: "oracle just past max LTV",
      verdict: blockLtv,
    },
    {
      assessment: {
        capacity: "exceedsCapacity",
        pricing: "oracle",
        projection: available({
          healthFactor: "0.9999",
          ltv: "0.86",
          maxLtv: "0.86",
        }),
        riskIncreasing: true,
      },
      case: "oracle health factor just below 1",
      verdict: blockHealthFactor,
    },
    {
      assessment: {
        capacity: "exceedsCapacity",
        pricing: "oracle",
        projection: available({
          healthFactor: "0.96",
          ltv: "0.9",
          maxLtv: "0.86",
        }),
        riskIncreasing: true,
      },
      case: "oracle within the display tolerance still blocks",
      verdict: blockHealthFactor,
    },
    // Display-priced projections keep the 5% tolerance.
    {
      assessment: {
        capacity: "withinCapacity",
        pricing: "display",
        projection: available({ healthFactor: "1", ltv: "0.8", maxLtv: "0.8" }),
        riskIncreasing: true,
      },
      case: "display at max LTV and health factor 1",
      verdict: allow,
    },
    {
      assessment: {
        capacity: "exceedsCapacity",
        pricing: "display",
        projection: available({
          healthFactor: null,
          ltv: "0.84",
          maxLtv: "0.8",
        }),
        riskIncreasing: true,
      },
      case: "display exactly at max LTV × 1.05",
      verdict: warn,
    },
    {
      assessment: {
        capacity: "exceedsCapacity",
        pricing: "display",
        projection: available({
          healthFactor: null,
          ltv: "0.8401",
          maxLtv: "0.8",
        }),
        riskIncreasing: true,
      },
      case: "display just past max LTV × 1.05",
      verdict: blockLtv,
    },
    {
      assessment: {
        capacity: "exceedsCapacity",
        pricing: "display",
        projection: available({ healthFactor: null, ltv: "1", maxLtv: "0.99" }),
        riskIncreasing: true,
      },
      case: "display at LTV 1 inside the max LTV tolerance",
      verdict: blockLtv,
    },
    {
      assessment: {
        capacity: "exceedsCapacity",
        pricing: "display",
        projection: available({
          healthFactor: "0.96",
          ltv: "0.8",
          maxLtv: "0.8",
        }),
        riskIncreasing: true,
      },
      case: "display health factor × 1.05 just above 1",
      verdict: warn,
    },
    {
      assessment: {
        capacity: "exceedsCapacity",
        pricing: "display",
        projection: available({
          healthFactor: "0.95",
          ltv: "0.8",
          maxLtv: "0.8",
        }),
        riskIncreasing: true,
      },
      case: "display health factor × 1.05 just below 1",
      verdict: blockHealthFactor,
    },
    {
      assessment: {
        capacity: "exceedsCapacity",
        pricing: "display",
        projection: available({
          healthFactor: "1.2",
          ltv: "0.7",
          maxLtv: "0.8",
        }),
        riskIncreasing: true,
      },
      case: "display capacity exceeded within the tolerance",
      verdict: warn,
    },
    // Risk-reducing changes never warn or block on risk.
    {
      assessment: {
        capacity: "exceedsCapacity",
        pricing: "oracle",
        projection: available({
          healthFactor: "0.5",
          ltv: "1.5",
          maxLtv: "0.86",
        }),
        riskIncreasing: false,
      },
      case: "oracle risk-reducing change past every limit",
      verdict: allow,
    },
    {
      assessment: {
        capacity: "exceedsCapacity",
        pricing: "display",
        projection: available({
          healthFactor: "0.5",
          ltv: "1.5",
          maxLtv: "0.8",
        }),
        riskIncreasing: false,
      },
      case: "display risk-reducing change past every limit",
      verdict: allow,
    },
    // Risk Unavailable allows; the capacity warning still applies.
    {
      assessment: {
        capacity: "withinCapacity",
        pricing: "display",
        projection: riskUnavailable,
        riskIncreasing: true,
      },
      case: "Risk Unavailable within capacity",
      verdict: allow,
    },
    {
      assessment: {
        capacity: "exceedsCapacity",
        pricing: "display",
        projection: riskUnavailable,
        riskIncreasing: true,
      },
      case: "Risk Unavailable past capacity",
      verdict: warn,
    },
  ])("$case", ({ assessment, verdict }) => {
    expect(assessRiskGate(assessment)).toEqual(verdict);
  });
});
