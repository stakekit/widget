import { Schema } from "effect";
import * as BorrowApi from "../../generated/api/borrow";
import { TransactionId, WalletAddress } from "./ids";
import { BorrowNetwork } from "./network";
import { NumberFromString } from "./scalars";

export class Transaction extends Schema.Class<Transaction>("BorrowTransaction")(
  {
    ...BorrowApi.TransactionDto.fields,
    id: TransactionId,
    network: BorrowNetwork,
    chainId: NumberFromString,
    address: WalletAddress,
  }
) {}

export const SubmitTransactionCommand = Schema.Struct(
  BorrowApi.SubmitTransactionDto.fields
);
export type SubmitTransactionCommand = typeof SubmitTransactionCommand.Type;

export const SubmitTransactionResult = Schema.Struct(
  BorrowApi.SubmitTransactionResponseDto.fields
);
export type SubmitTransactionResult = typeof SubmitTransactionResult.Type;
