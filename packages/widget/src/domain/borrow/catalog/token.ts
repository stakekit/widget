import { Schema } from "effect";
import * as BorrowApi from "../../../generated/api/borrow";
import { TokenAddress } from "../ids";

export const BorrowToken = Schema.Struct({
  ...BorrowApi.CollateralTokenDto.fields.token.fields,
  address: Schema.optionalKey(TokenAddress),
});
export type BorrowToken = typeof BorrowToken.Type;
