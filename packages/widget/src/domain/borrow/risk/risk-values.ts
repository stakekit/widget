import { Schema } from "effect";
import { ExactDecimal, NonNegativeExactDecimal } from "../../finance/scalars";

export const RiskRatio = ExactDecimal.check(
  Schema.makeFilter((value) =>
    value.isGreaterThanOrEqualTo(0) && value.isLessThanOrEqualTo(1)
      ? true
      : "expected a ratio between 0 and 1"
  )
);

export const NonNegativeRiskValue = NonNegativeExactDecimal;
