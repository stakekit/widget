import { Schema } from "effect";
import * as BorrowApi from "../../../generated/api/borrow";
import { ExactDecimal, NonNegativeExactDecimal } from "../../finance/scalars";
import { RiskRatio } from "../risk/risk-values";
import { BorrowToken } from "./token";

export const CollateralToken = Schema.Struct({
  ...BorrowApi.CollateralTokenDto.fields,
  liquidationPenalty: RiskRatio,
  liquidationThreshold: RiskRatio,
  maxLtv: RiskRatio,
  priceUsd: NonNegativeExactDecimal,
  supplyRate: ExactDecimal,
  token: BorrowToken,
});
export type CollateralToken = typeof CollateralToken.Type;
