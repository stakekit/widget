import type { GetType } from "purify-ts";
import {
  array,
  boolean,
  Codec,
  Left,
  number,
  oneOf,
  optional,
  Right,
  record,
  string,
  unknown,
} from "purify-ts";
import { type Address, type Hex, numberToHex } from "viem";
import type { GetEitherRight } from "../../types/utils";

const bigintCodec = Codec.custom<bigint>({
  decode: (input) => {
    if (typeof input !== "string" && typeof input !== "number") {
      return Left("Invalid value type");
    }

    const val = BigInt(input);

    return Right(val);
  },
  encode: (input) => input.toString(),
});

const hexStringCodec = Codec.custom<Hex>({
  decode: (input) =>
    typeof input === "string" && input.startsWith("0x")
      ? Right(input as Hex)
      : Left("Invalid hex string"),
  encode: (input) => input,
});

const addressCodec = Codec.custom<Address>({
  decode: (input) =>
    typeof input === "string" && input.startsWith("0x")
      ? Right(input as Address)
      : Left("Invalid address"),
  encode: (input) => input,
});

export const unsignedEVMTransactionCodec = Codec.interface({
  data: hexStringCodec,
  to: addressCodec,
  gasLimit: bigintCodec,
  from: addressCodec,
  value: optional(bigintCodec),
  nonce: number,
  type: number,
  maxFeePerGas: optional(bigintCodec),
  maxPriorityFeePerGas: optional(bigintCodec),
  chainId: number,
});

export const decodeAndPrepareEvmTransaction = ({
  address,
  input,
}: {
  address: Address;
  input: unknown;
}) =>
  unsignedEVMTransactionCodec.decode(input).map((decodedTx) => ({
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
      : { type: "0x1" as const }),
  }));

export type DecodedEVMTransaction = GetEitherRight<
  ReturnType<typeof decodeAndPrepareEvmTransaction>
>;

export const unsignedTronTransactionCodec = Codec.interface({
  raw_data: Codec.interface({
    contract: array(record(string, unknown)),
    ref_block_bytes: string,
    ref_block_hash: string,
    expiration: number,
    timestamp: number,
    data: optional(unknown),
    fee_limit: optional(unknown),
  }),
  raw_data_hex: string,
  txID: string,
  visible: boolean,
});

export type DecodedTronTransaction = GetType<
  typeof unsignedTronTransactionCodec
>;

export const unsignedSolanaTransactionCodec = string;

export type DecodedSolanaTransaction = GetType<
  typeof unsignedSolanaTransactionCodec
>;

export const unsignedTonTransactionCodec = oneOf([
  Codec.interface({
    seqno: bigintCodec,
    message: string,
  }),
  array(
    Codec.interface({
      address: string,
      amount: string,
      payload: string,
    })
  ),
]);

export type DecodedTonTransaction = GetType<typeof unsignedTonTransactionCodec>;

export const substratePayloadCodec = Codec.interface({
  tx: Codec.interface({
    address: string,
    assetId: optional(hexStringCodec),
    blockHash: hexStringCodec,
    blockNumber: hexStringCodec,
    era: hexStringCodec,
    genesisHash: hexStringCodec,
    metadataHash: optional(hexStringCodec),
    method: string,
    mode: optional(number),
    nonce: hexStringCodec,
    specVersion: hexStringCodec,
    tip: hexStringCodec,
    transactionVersion: hexStringCodec,
    signedExtensions: array(string),
    version: number,
    metadataRpc: hexStringCodec,
  }),
  specName: string,
  specVersion: number,
  metadataRpc: hexStringCodec,
});

export type DecodedSubstrateTransaction = GetType<typeof substratePayloadCodec>;
