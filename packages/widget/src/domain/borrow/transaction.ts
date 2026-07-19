import { Effect, Schema } from "effect";
import * as BorrowApi from "../../generated/api/borrow";
import { TransactionId, WalletAddress } from "./ids";
import { BorrowNetwork } from "./network";

export class Transaction extends Schema.Class<Transaction>("BorrowTransaction")(
  {
    ...BorrowApi.TransactionDto.fields,
    id: TransactionId,
    network: BorrowNetwork,
    chainId: Schema.FiniteFromString,
    address: WalletAddress,
  }
) {}

const HexString = Schema.TemplateLiteral([Schema.Literal("0x"), Schema.String]);
const Numberish = Schema.Union([Schema.String, Schema.Number, Schema.BigInt]);

const BorrowWalletEvmSignablePayload = Schema.Struct({
  chainId: Schema.optionalKey(Numberish),
  data: HexString,
  from: HexString,
  gasLimit: Numberish,
  nonce: Schema.optionalKey(Numberish),
  to: HexString,
  type: Schema.optionalKey(Numberish),
  value: Schema.optionalKey(Numberish),
});

const BorrowEvmSignablePayloadInput = Schema.Union([
  BorrowWalletEvmSignablePayload,
  Schema.fromJsonString(BorrowWalletEvmSignablePayload),
]);

const normalizeNumberish = (
  value: bigint | number | string | undefined,
  fallback = "0"
) => (value == null ? fallback : value.toString());

const numberishToNumber = (
  value: bigint | number | string | undefined,
  fallback: bigint | number | string = 0
) => Number(value == null ? fallback : value);

export const decodeBorrowTransactionForWallet = (transaction: Transaction) =>
  Schema.decodeUnknownEffect(BorrowEvmSignablePayloadInput)(
    transaction.signablePayload
  ).pipe(
    Effect.map((payload) =>
      JSON.stringify({
        chainId: numberishToNumber(payload.chainId, transaction.chainId),
        data: payload.data,
        from: payload.from,
        gasLimit: normalizeNumberish(payload.gasLimit),
        nonce: numberishToNumber(payload.nonce),
        to: payload.to,
        type: numberishToNumber(payload.type),
        value: normalizeNumberish(payload.value),
      })
    )
  );

export const SubmitTransactionCommand = Schema.Struct(
  BorrowApi.SubmitTransactionDto.fields
);
export type SubmitTransactionCommand = typeof SubmitTransactionCommand.Type;

export const SubmitTransactionResult = Schema.Struct(
  BorrowApi.SubmitTransactionResponseDto.fields
);
export type SubmitTransactionResult = typeof SubmitTransactionResult.Type;
