import { Schema } from "effect";
import type { Hex } from "viem";

const HexString = Schema.declare<Hex>(
  (input): input is Hex => typeof input === "string" && input.startsWith("0x"),
  { expected: "a 0x-prefixed hex string" }
);

export const substratePayloadCodec = Schema.Struct({
  tx: Schema.Struct({
    address: Schema.String,
    assetId: Schema.optionalKey(HexString),
    blockHash: HexString,
    blockNumber: HexString,
    era: HexString,
    genesisHash: HexString,
    metadataHash: Schema.optionalKey(HexString),
    method: Schema.String,
    mode: Schema.optionalKey(Schema.Finite),
    nonce: HexString,
    specVersion: HexString,
    tip: HexString,
    transactionVersion: HexString,
    signedExtensions: Schema.Array(Schema.String),
    version: Schema.Finite,
    metadataRpc: HexString,
  }),
  specName: Schema.String,
  specVersion: Schema.Finite,
  metadataRpc: HexString,
});
