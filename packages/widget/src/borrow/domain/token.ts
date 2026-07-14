import { Schema } from "effect";
import * as BorrowApi from "../../generated/api/borrow";
import { TokenAddress } from "./ids";

export class BorrowToken extends Schema.Class<BorrowToken>("BorrowToken")({
  ...BorrowApi.CollateralTokenDto.fields.token.fields,
  address: Schema.optionalKey(TokenAddress),
}) {}
