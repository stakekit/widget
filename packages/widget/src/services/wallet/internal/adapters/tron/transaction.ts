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
