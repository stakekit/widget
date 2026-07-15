import { Schema } from "effect";
import * as BorrowApi from "../../generated/api/borrow";
import { BorrowToken } from "./token";

export class CollateralToken extends Schema.Class<CollateralToken>(
  "BorrowCollateralToken"
)({
  ...BorrowApi.CollateralTokenDto.fields,
  token: BorrowToken,
  priceUsd: Schema.FiniteFromString,
  maxLtv: Schema.FiniteFromString,
  liquidationThreshold: Schema.FiniteFromString,
  liquidationPenalty: Schema.FiniteFromString,
  supplyRate: Schema.FiniteFromString,
}) {}
