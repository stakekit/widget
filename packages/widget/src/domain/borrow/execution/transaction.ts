import { Effect, Schema } from "effect";
import * as BorrowApi from "../../../generated/api/borrow";
import { ExactBaseUnitAmount } from "../../finance/scalars";
import { TransactionId, WalletAddress } from "../ids";
import { BorrowNetwork } from "../network";

export const Transaction = Schema.Struct({
  ...BorrowApi.TransactionDto.fields,
  address: WalletAddress,
  // ast-grep-ignore: no-financial-finite-from-string -- chain IDs stay safe integer numbers
  chainId: Schema.FiniteFromString,
  id: TransactionId,
  network: BorrowNetwork,
});
export type Transaction = typeof Transaction.Type;

const HexString = Schema.TemplateLiteral([Schema.Literal("0x"), Schema.String]);
const Countish = Schema.Union([Schema.String, Schema.Number, Schema.BigInt]);

const BorrowWalletEvmSignablePayload = Schema.Struct({
  chainId: Schema.optionalKey(Countish),
  data: HexString,
  from: HexString,
  gasLimit: ExactBaseUnitAmount,
  nonce: Schema.optionalKey(Countish),
  to: HexString,
  type: Schema.optionalKey(Countish),
  value: Schema.optionalKey(ExactBaseUnitAmount),
});

const BorrowEvmSignablePayloadInput = Schema.Union([
  BorrowWalletEvmSignablePayload,
  Schema.fromJsonString(BorrowWalletEvmSignablePayload),
]);

const countishToSafeInteger = (
  value: bigint | number | string | undefined,
  fallback: number
) => {
  const count = Number(value == null ? fallback : value);

  return Number.isSafeInteger(count) ? count : fallback;
};

export const decodeBorrowTransactionForWallet = (transaction: Transaction) =>
  Schema.decodeUnknownEffect(BorrowEvmSignablePayloadInput)(
    transaction.signablePayload
  ).pipe(
    Effect.map((payload) =>
      JSON.stringify({
        chainId: countishToSafeInteger(payload.chainId, transaction.chainId),
        data: payload.data,
        from: payload.from,
        gasLimit: payload.gasLimit.toString(),
        nonce: countishToSafeInteger(payload.nonce, 0),
        to: payload.to,
        type: countishToSafeInteger(payload.type, 0),
        value: (payload.value ?? 0n).toString(),
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
