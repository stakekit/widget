import { Schema } from "effect";
import * as BorrowApi from "../../generated/api/borrow";
import { NumberFromString } from "./scalars";
import { BorrowToken } from "./token";

export class CollateralToken extends Schema.Class<CollateralToken>(
  "BorrowCollateralToken"
)({
  ...BorrowApi.CollateralTokenDto.fields,
  token: BorrowToken,
  priceUsd: NumberFromString,
  maxLtv: NumberFromString,
  liquidationThreshold: NumberFromString,
  liquidationPenalty: NumberFromString,
  supplyRate: NumberFromString,
}) {}
