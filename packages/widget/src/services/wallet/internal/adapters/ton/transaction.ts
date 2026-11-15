import { Effect, Schema, SchemaTransformation } from "effect";

const BigIntFromNumber = Schema.Finite.pipe(
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
type TonTransfer = DecodedTonRawTransaction[number];

class TonMessageError extends Schema.TaggedError<
  TonMessageError,
  { readonly brand: unique symbol }
>()("TonMessageError", {
  message: Schema.String,
}) {}

const tonMessageError = (message: string) => TonMessageError.make({ message });

/**
 * `@ton/core` reaches `@ton/crypto` and Node's `crypto` polyfill, so its cell
 * codec loads with the first TON message rather than the initial download.
 */
const tonMessageCodec = Effect.tryPromise({
  try: () => import("./message-codec"),
  catch: () => tonMessageError("Could not load TON message support"),
});

/** Reads a base64 TON message cell as the internal transfer it carries. */
export const decodeTonInternalTransfer = (
  message: string
): Effect.Effect<TonTransfer, TonMessageError> =>
  tonMessageCodec.pipe(
    Effect.flatMap((codec) =>
      Effect.fromResult(codec.decodeInternalTransfer(message)).pipe(
        Effect.mapError(tonMessageError)
      )
    )
  );

/** The hex hash of a base64 bag of cells, e.g. a signed external message. */
export const tonCellHash = (
  boc: string
): Effect.Effect<string, TonMessageError> =>
  tonMessageCodec.pipe(
    Effect.flatMap((codec) =>
      Effect.fromResult(codec.cellHash(boc)).pipe(
        Effect.mapError(tonMessageError)
      )
    )
  );

export const normalizeTonTransactionToRaw = (
  tx: DecodedTonTransaction
): Effect.Effect<DecodedTonRawTransaction, TonMessageError> =>
  "message" in tx
    ? decodeTonInternalTransfer(tx.message).pipe(
        Effect.map((transfer) => [transfer])
      )
    : Effect.succeed(tx);
