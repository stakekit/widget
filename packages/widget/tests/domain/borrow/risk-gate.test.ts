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
    // Oracle-anchored projections block once clearly past protocol limits; a
    // 0.1% margin absorbs a stale or rounded snapshot right at the limit.
    {
      assessment: {
        addsDebt: true,
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
        addsDebt: true,
        capacity: "exceedsCapacity",
        pricing: "oracle",
        projection: available({
          healthFactor: null,
          ltv: "0.8608",
          maxLtv: "0.86",
        }),
        riskIncreasing: true,
      },
      case: "oracle past max LTV within the snapshot margin",
      verdict: warn,
    },
    {
      assessment: {
        addsDebt: true,
        capacity: "exceedsCapacity",
        pricing: "oracle",
        projection: available({
          healthFactor: null,
          ltv: "0.861",
          maxLtv: "0.86",
        }),
        riskIncreasing: true,
      },
      case: "oracle past max LTV beyond the snapshot margin",
      verdict: blockLtv,
    },
    {
      assessment: {
        addsDebt: true,
        capacity: "exceedsCapacity",
        pricing: "oracle",
        projection: available({
          healthFactor: "0.9992",
          ltv: "0.86",
          maxLtv: "0.86",
        }),
        riskIncreasing: true,
      },
      case: "oracle health factor below 1 within the snapshot margin",
      verdict: warn,
    },
    {
      assessment: {
        addsDebt: true,
        capacity: "exceedsCapacity",
        pricing: "oracle",
        projection: available({
          healthFactor: "0.9989",
          ltv: "0.86",
          maxLtv: "0.86",
        }),
        riskIncreasing: true,
      },
      case: "oracle health factor below 1 beyond the snapshot margin",
      verdict: blockHealthFactor,
    },
    {
      assessment: {
        addsDebt: true,
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
    // Protocols check max LTV only when debt grows; collateral removals are
    // bounded by the health factor alone.
    {
      assessment: {
        addsDebt: false,
        capacity: "exceedsCapacity",
        pricing: "display",
        projection: available({
          healthFactor: "1.01",
          ltv: "0.9",
          maxLtv: "0.8",
        }),
        riskIncreasing: true,
      },
      case: "display collateral removal past max LTV with a healthy factor",
      verdict: warn,
    },
    {
      assessment: {
        addsDebt: false,
        capacity: "exceedsCapacity",
        pricing: "display",
        projection: available({
          healthFactor: "0.99",
          ltv: "1",
          maxLtv: "0.8",
        }),
        riskIncreasing: true,
      },
      case: "display collateral removal at LTV 1 with health factor within tolerance",
      verdict: warn,
    },
    {
      assessment: {
        addsDebt: false,
        capacity: "exceedsCapacity",
        pricing: "display",
        projection: available({
          healthFactor: "0",
          ltv: "1",
          maxLtv: "0.8",
        }),
        riskIncreasing: true,
      },
      case: "display removal of all collateral behind remaining debt",
      verdict: blockHealthFactor,
    },
    // Display-priced projections keep the 5% tolerance; these add debt.
    {
      assessment: {
        addsDebt: true,
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
        addsDebt: true,
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
        addsDebt: true,
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
        addsDebt: true,
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
        addsDebt: true,
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
        addsDebt: true,
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
        addsDebt: true,
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
        addsDebt: false,
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
        addsDebt: false,
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
        addsDebt: true,
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
        addsDebt: true,
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
