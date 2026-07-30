import { Schema } from "effect";

export const RiskRatioFromString = Schema.FiniteFromString.check(
  Schema.isGreaterThanOrEqualTo(0),
  Schema.isLessThanOrEqualTo(1)
);

export const NonNegativeFiniteFromString = Schema.FiniteFromString.check(
  Schema.isGreaterThanOrEqualTo(0)
);
