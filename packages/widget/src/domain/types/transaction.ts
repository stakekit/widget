import {
  Cell,
  type CommonMessageInfoRelaxedInternal,
  loadMessageRelaxed,
} from "@ton/core";
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
import type { TransactionVerificationMessageDto } from "../../generated/api/legacy";
import type { GetEitherRight } from "../../types/utils";

export type { TransactionVerificationMessageDto };

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
  gasPrice: optional(bigintCodec),
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
      : {
          type: "0x1" as const,
          gasPrice: decodedTx.gasPrice
            ? numberToHex(decodedTx.gasPrice)
            : undefined,
        }),
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

export const unsignedTonTransactionTonConnectCodec = Codec.interface({
  seqno: bigintCodec,
  message: string,
});

export const unsignedTonTransactionCodec = oneOf([
  unsignedTonTransactionTonConnectCodec,
  array(
    Codec.interface({
      address: string,
      amount: string,
      payload: string,
    })
  ),
]);

export type DecodedTonTransaction = GetType<typeof unsignedTonTransactionCodec>;

type DecodedTonRawTransaction = Extract<
  DecodedTonTransaction,
  ReadonlyArray<unknown>
>;

export const normalizeTonTransactionToRaw = (
  tx: DecodedTonTransaction
): DecodedTonRawTransaction => {
  if (Array.isArray(tx)) {
    return tx;
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
