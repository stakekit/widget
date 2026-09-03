import { Effect, Schema, SchemaTransformation } from "effect";
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
const Countish = Schema.Union([
  Schema.String,
  Schema.Finite,
  Schema.BigInt,
]).pipe(
  Schema.decodeTo(
    Schema.Natural,
    SchemaTransformation.transform<number, string | number | bigint>({
      decode: Number,
      encode: (value) => value,
    })
  )
);

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

const BorrowWalletEvmTransactionInput = Schema.Struct({
  signablePayload: BorrowEvmSignablePayloadInput,
  signingFormat: Schema.optionalKey(Schema.Literal("EVM_TRANSACTION")),
});

const BorrowEip712TypeProperty = Schema.Struct({
  name: Schema.String,
  type: Schema.String,
});

const BorrowEip712TypedDataPayload = Schema.Struct({
  domain: Schema.Struct({
    chainId: Schema.optionalKey(Countish),
    name: Schema.optionalKey(Schema.String),
    salt: Schema.optionalKey(HexString),
    verifyingContract: Schema.optionalKey(HexString),
    version: Schema.optionalKey(Schema.String),
  }),
  message: Schema.Record(Schema.String, Schema.Json),
  primaryType: Schema.String,
  types: Schema.Record(Schema.String, Schema.Array(BorrowEip712TypeProperty)),
});

const BorrowEip712TypedDataInput = Schema.Union([
  BorrowEip712TypedDataPayload,
  Schema.fromJsonString(BorrowEip712TypedDataPayload),
]);

export const decodeBorrowTransactionForWallet = (transaction: Transaction) =>
  Schema.decodeUnknownEffect(BorrowWalletEvmTransactionInput)(transaction).pipe(
    Effect.map(({ signablePayload: payload }) =>
      JSON.stringify({
        chainId: payload.chainId ?? transaction.chainId,
        data: payload.data,
        from: payload.from,
        gasLimit: payload.gasLimit.toString(),
        ...(payload.nonce === undefined ? {} : { nonce: payload.nonce }),
        to: payload.to,
        type: payload.type ?? 0,
        value: (payload.value ?? 0n).toString(),
      })
    )
  );

export const decodeBorrowTypedDataForWallet = (transaction: Transaction) =>
  Schema.decodeUnknownEffect(BorrowEip712TypedDataInput)(
    transaction.signablePayload
  ).pipe(
    Effect.map((typedData) => {
      const { chainId, ...domain } = typedData.domain;
      return {
        domain: {
          ...domain,
          ...(chainId === undefined ? {} : { chainId }),
        },
        message: typedData.message,
        primaryType: typedData.primaryType,
        types: Object.fromEntries(
          Object.entries(typedData.types).filter(
            ([typeName]) => typeName !== "EIP712Domain"
          )
        ),
      };
    })
  );

export const SubmitTransactionCommand = Schema.Struct(
  BorrowApi.SubmitTransactionDto.fields
);
export type SubmitTransactionCommand = typeof SubmitTransactionCommand.Type;

export const SubmitTransactionResult = Schema.Struct(
  BorrowApi.SubmitTransactionResponseDto.fields
);
export type SubmitTransactionResult = typeof SubmitTransactionResult.Type;
