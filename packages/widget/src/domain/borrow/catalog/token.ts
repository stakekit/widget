import { Schema, Struct } from "effect";
import * as BorrowApi from "../../../generated/api/borrow";
import { TokenAddress } from "../ids";

export const BorrowToken = Schema.Struct({
  ...Struct.pick(BorrowApi.TokenDto.fields, [
    "symbol",
    "name",
    "decimals",
    "logoURI",
  ]),
  address: Schema.optionalKey(TokenAddress),
});
export type BorrowToken = typeof BorrowToken.Type;
