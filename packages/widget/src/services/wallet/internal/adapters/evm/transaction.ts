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
