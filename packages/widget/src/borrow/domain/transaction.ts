import { Schema } from "effect";
import * as BorrowApi from "../../generated/api/borrow";
import { TransactionId } from "./ids";
import { NumberFromString } from "./scalars";

export class Transaction extends Schema.Class<Transaction>("BorrowTransaction")(
  {
    ...BorrowApi.TransactionDto.fields,
    id: TransactionId,
    chainId: NumberFromString,
  }
) {}
