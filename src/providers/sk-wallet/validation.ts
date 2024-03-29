import { Codec, Left, Right, number, optional, string } from "purify-ts";
import { Hex } from "viem";
import { TronLinkAdapter } from "@tronweb3/tronwallet-adapter-tronlink";

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

export const unsignedEVMTransactionCodec = Codec.interface({
  data: hexStringCodec,
  to: string,
  gasLimit: bigintCodec,
  from: string,
  value: optional(bigintCodec),
  nonce: number,
  type: number,
  maxFeePerGas: optional(bigintCodec),
  maxPriorityFeePerGas: optional(bigintCodec),
  chainId: number,
});

type TronTx = Parameters<TronLinkAdapter["signTransaction"]>[0];

export const unsignedTronTransactionCodec = Codec.custom<TronTx>({
  decode(value) {
    const val = value as Partial<TronTx>;

    if (val.raw_data && val.raw_data_hex && val.txID && "visible" in val) {
      return Right(val as TronTx);
    } else {
      return Left("Invalid Tron transaction");
    }
  },
  encode(value) {
    return value;
  },
});
