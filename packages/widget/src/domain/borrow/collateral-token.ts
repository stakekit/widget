import { Schema } from "effect";
import * as BorrowApi from "../../generated/api/borrow";
import { RiskRatioFromString } from "./risk-values";
import { BorrowToken } from "./token";

export const CollateralToken = Schema.Struct({
  ...BorrowApi.CollateralTokenDto.fields,
  liquidationPenalty: RiskRatioFromString,
  liquidationThreshold: RiskRatioFromString,
  maxLtv: RiskRatioFromString,
  priceUsd: Schema.FiniteFromString.check(Schema.isGreaterThanOrEqualTo(0)),
  supplyRate: Schema.FiniteFromString,
  token: BorrowToken,
});
export type CollateralToken = typeof CollateralToken.Type;
