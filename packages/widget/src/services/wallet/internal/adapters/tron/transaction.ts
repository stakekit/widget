import { Schema } from "effect";

export const unsignedTronTransactionCodec = Schema.Struct({
  raw_data: Schema.Struct({
    contract: Schema.Array(Schema.Record(Schema.String, Schema.Unknown)),
    ref_block_bytes: Schema.String,
    ref_block_hash: Schema.String,
    expiration: Schema.Finite,
    timestamp: Schema.Finite,
    data: Schema.optionalKey(Schema.Unknown),
    fee_limit: Schema.optionalKey(Schema.Unknown),
  }),
  raw_data_hex: Schema.String,
  txID: Schema.String,
  visible: Schema.Boolean,
});

export type UnsignedTronTransaction = typeof unsignedTronTransactionCodec.Type;

// Wallets may add fields (e.g. `ret`); the backend receives them unchanged.
const undeclaredFields = [
  Schema.Record(Schema.String, Schema.Unknown),
] as const;

export const signedTronTransactionCodec = Schema.StructWithRest(
  Schema.Struct({
    ...unsignedTronTransactionCodec.fields,
    raw_data: Schema.StructWithRest(
      unsignedTronTransactionCodec.fields.raw_data,
      undeclaredFields
    ),
    signature: Schema.Array(Schema.String),
    contract_address: Schema.optionalKey(Schema.String),
  }),
  undeclaredFields
);

export type SignedTronTransaction = typeof signedTronTransactionCodec.Type;
