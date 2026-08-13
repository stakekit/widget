import {
  Cell,
  type CommonMessageInfoRelaxedInternal,
  loadMessageRelaxed,
} from "@ton/core";
import { Schema, SchemaTransformation } from "effect";

const BigIntFromNumber = Schema.Number.pipe(
  Schema.decodeTo(
    Schema.BigInt,
    SchemaTransformation.transform({
      decode: (value) => BigInt(value),
      encode: (value) => Number(value),
    })
  )
);
const BigIntFromString = Schema.String.pipe(
  Schema.decodeTo(
    Schema.BigInt,
    SchemaTransformation.transform({
      decode: (value) => BigInt(value),
      encode: (value) => value.toString(),
    })
  )
);
const BigIntFromStringOrNumber = Schema.Union([
  BigIntFromString,
  BigIntFromNumber,
]);
const UnsignedTonTransactionTonConnect = Schema.Struct({
  seqno: BigIntFromStringOrNumber,
  message: Schema.String,
});
const UnsignedTonTransaction = Schema.Union([
  UnsignedTonTransactionTonConnect,
  Schema.Array(
    Schema.Struct({
      address: Schema.String,
      amount: Schema.String,
      payload: Schema.String,
    })
  ),
]);

export const unsignedTonTransactionTonConnectCodec =
  UnsignedTonTransactionTonConnect;
export const unsignedTonTransactionCodec = UnsignedTonTransaction;
type DecodedTonTransaction = typeof UnsignedTonTransaction.Type;
type DecodedTonRawTransaction = Extract<
  DecodedTonTransaction,
  ReadonlyArray<unknown>
>;

export const normalizeTonTransactionToRaw = (
  tx: DecodedTonTransaction
): DecodedTonRawTransaction => {
  if (!("message" in tx)) return tx as DecodedTonRawTransaction;
  const parsedTx = loadMessageRelaxed(Cell.fromBase64(tx.message).beginParse());
  const info = parsedTx.info as CommonMessageInfoRelaxedInternal;
  return [
    {
      address: info.dest.toString(),
      amount: info.value.coins.toString(),
      payload: parsedTx.body.toBoc().toString("base64"),
    },
  ];
};
