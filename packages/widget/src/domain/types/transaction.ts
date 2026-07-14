import {
  Cell,
  type CommonMessageInfoRelaxedInternal,
  loadMessageRelaxed,
} from "@ton/core";
import { Result, Schema, SchemaTransformation } from "effect";
import { type Address, type Hex, numberToHex } from "viem";

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

const HexString = Schema.declare<Hex>(
  (input): input is Hex => typeof input === "string" && input.startsWith("0x"),
  { expected: "a 0x-prefixed hex string" }
);

const EvmAddress = Schema.declare<Address>(
  (input): input is Address =>
    typeof input === "string" && input.startsWith("0x"),
  { expected: "a 0x-prefixed address" }
);

const UnsignedEvmTransaction = Schema.Struct({
  data: HexString,
  to: EvmAddress,
  gasLimit: BigIntFromStringOrNumber,
  from: EvmAddress,
  value: Schema.optionalKey(BigIntFromStringOrNumber),
  nonce: Schema.Number,
  type: Schema.Number,
  gasPrice: Schema.optionalKey(BigIntFromStringOrNumber),
  maxFeePerGas: Schema.optionalKey(BigIntFromStringOrNumber),
  maxPriorityFeePerGas: Schema.optionalKey(BigIntFromStringOrNumber),
  chainId: Schema.Number,
});

export const unsignedEVMTransactionCodec = UnsignedEvmTransaction;

const prepareDecodedEvmTransaction = (
  decodedTx: typeof UnsignedEvmTransaction.Type,
  address: Address
) => ({
  to: decodedTx.to,
  from: address,
  data: decodedTx.data,
  value: decodedTx.value ? numberToHex(decodedTx.value) : undefined,
  nonce: numberToHex(decodedTx.nonce),
  gas: numberToHex(decodedTx.gasLimit),
  chainId: numberToHex(decodedTx.chainId),
  ...(decodedTx.maxFeePerGas
    ? {
        type: "0x2" as const,
        maxFeePerGas: numberToHex(decodedTx.maxFeePerGas),
        maxPriorityFeePerGas: decodedTx.maxPriorityFeePerGas
          ? numberToHex(decodedTx.maxPriorityFeePerGas)
          : undefined,
      }
    : {
        type: "0x1" as const,
        gasPrice: decodedTx.gasPrice
          ? numberToHex(decodedTx.gasPrice)
          : undefined,
      }),
});

export const decodeAndPrepareEvmTransaction = ({
  address,
  tx,
}: {
  address: Address;
  tx: string;
}) =>
  Schema.decodeResult(Schema.fromJsonString(UnsignedEvmTransaction))(tx).pipe(
    Result.map((decodedTx) => prepareDecodedEvmTransaction(decodedTx, address))
  );

export type DecodedEVMTransaction = ReturnType<
  typeof prepareDecodedEvmTransaction
>;

const UnsignedTronTransaction = Schema.Struct({
  raw_data: Schema.Struct({
    contract: Schema.Array(Schema.Record(Schema.String, Schema.Unknown)),
    ref_block_bytes: Schema.String,
    ref_block_hash: Schema.String,
    expiration: Schema.Number,
    timestamp: Schema.Number,
    data: Schema.optionalKey(Schema.Unknown),
    fee_limit: Schema.optionalKey(Schema.Unknown),
  }),
  raw_data_hex: Schema.String,
  txID: Schema.String,
  visible: Schema.Boolean,
});

export const unsignedTronTransactionCodec = UnsignedTronTransaction;

export type DecodedTronTransaction = typeof UnsignedTronTransaction.Type;

const UnsignedSolanaTransaction = Schema.String;
export const unsignedSolanaTransactionCodec = UnsignedSolanaTransaction;

export type DecodedSolanaTransaction = typeof UnsignedSolanaTransaction.Type;

type SolanaTransactionEncoding = "base64" | "hex";

type SolanaTransactionBytes = {
  encoding: SolanaTransactionEncoding;
  buffer: Buffer;
};

const solanaHexStringRegex = /^[0-9a-fA-F]+$/u;

const stripSolanaHexPrefix = (tx: string) =>
  tx.startsWith("0x") ? tx.slice(2) : tx;

const isSolanaHexTransaction = (tx: DecodedSolanaTransaction): boolean => {
  const withoutHexPrefix = stripSolanaHexPrefix(tx.trim());

  return (
    withoutHexPrefix.length > 0 &&
    withoutHexPrefix.length % 2 === 0 &&
    solanaHexStringRegex.test(withoutHexPrefix)
  );
};

export const decodeSolanaTransactionToBuffer = (
  tx: DecodedSolanaTransaction
): SolanaTransactionBytes => {
  const normalizedTx = tx.trim();
  const withoutHexPrefix = stripSolanaHexPrefix(normalizedTx);

  if (isSolanaHexTransaction(normalizedTx)) {
    return {
      encoding: "hex",
      buffer: Buffer.from(withoutHexPrefix, "hex"),
    };
  }

  return {
    encoding: "base64",
    buffer: Buffer.from(normalizedTx, "base64"),
  };
};

export const normalizeSolanaTransactionToHex = (
  tx: DecodedSolanaTransaction
): DecodedSolanaTransaction =>
  decodeSolanaTransactionToBuffer(tx).buffer.toString("hex");

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

export type DecodedTonTransaction = typeof UnsignedTonTransaction.Type;

type DecodedTonRawTransaction = Extract<
  DecodedTonTransaction,
  ReadonlyArray<unknown>
>;

export const normalizeTonTransactionToRaw = (
  tx: DecodedTonTransaction
): DecodedTonRawTransaction => {
  if (!("message" in tx)) {
    return tx as DecodedTonRawTransaction;
  }

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

const SubstratePayload = Schema.Struct({
  tx: Schema.Struct({
    address: Schema.String,
    assetId: Schema.optionalKey(HexString),
    blockHash: HexString,
    blockNumber: HexString,
    era: HexString,
    genesisHash: HexString,
    metadataHash: Schema.optionalKey(HexString),
    method: Schema.String,
    mode: Schema.optionalKey(Schema.Number),
    nonce: HexString,
    specVersion: HexString,
    tip: HexString,
    transactionVersion: HexString,
    signedExtensions: Schema.Array(Schema.String),
    version: Schema.Number,
    metadataRpc: HexString,
  }),
  specName: Schema.String,
  specVersion: Schema.Number,
  metadataRpc: HexString,
});

export const substratePayloadCodec = SubstratePayload;

export type DecodedSubstrateTransaction = typeof SubstratePayload.Type;
