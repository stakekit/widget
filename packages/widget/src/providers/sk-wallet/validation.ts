import type { GetType } from "purify-ts";
import {
  Codec,
  Left,
  Right,
  boolean,
  number,
  optional,
  record,
  string,
  unknown,
} from "purify-ts";
import type { Address, Hex } from "viem";

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

export type DecodedEVMTransaction = GetType<typeof unsignedEVMTransactionCodec>;

export const unsignedTronTransactionCodec = Codec.interface({
  raw_data: record(string, unknown),
  raw_data_hex: string,
  txID: string,
  visible: boolean,
});

export const unsignedSolanaTransactionCodec = string;

export const unsignedTonTransactionCodec = Codec.interface({
  seqno: bigintCodec,
  message: string,
});
