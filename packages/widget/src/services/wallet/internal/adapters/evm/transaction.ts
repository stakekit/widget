import { Effect, Schema, SchemaTransformation } from "effect";
import { type Address, type Hex, hexToBigInt, isHex, numberToHex } from "viem";
import { ExactBaseUnitAmount } from "../../../../../domain/finance/scalars";

const HexString = Schema.declare<Hex>(
  (input): input is Hex => typeof input === "string" && input.startsWith("0x"),
  { expected: "a 0x-prefixed hex string" }
);
const EvmAddress = Schema.declare<Address>(
  (input): input is Address =>
    typeof input === "string" && input.startsWith("0x"),
  { expected: "a 0x-prefixed address" }
);

/**
 * EVM nodes quote transaction quantities as hex, while the API quotes them as
 * decimal strings or safe integers.
 */
const HexQuantity = Schema.String.check(
  Schema.makeFilter((value) =>
    isHex(value) && value.length > 2
      ? true
      : "expected a 0x-prefixed hex quantity"
  )
).pipe(
  Schema.decodeTo(
    Schema.BigInt,
    SchemaTransformation.transform({
      decode: (value) => hexToBigInt(value as Hex),
      encode: (value) => numberToHex(value),
    })
  )
);
const EvmBaseUnitQuantity = Schema.Union([ExactBaseUnitAmount, HexQuantity]);

const UnsignedEvmTransaction = Schema.Struct({
  data: HexString,
  to: EvmAddress,
  gasLimit: EvmBaseUnitQuantity,
  from: EvmAddress,
  value: Schema.optionalKey(EvmBaseUnitQuantity),
  nonce: Schema.Finite,
  type: Schema.Finite,
  gasPrice: Schema.optionalKey(EvmBaseUnitQuantity),
  maxFeePerGas: Schema.optionalKey(EvmBaseUnitQuantity),
  maxPriorityFeePerGas: Schema.optionalKey(EvmBaseUnitQuantity),
  chainId: Schema.Finite,
});

export const unsignedEVMTransactionCodec = UnsignedEvmTransaction;

const UnsignedEvmTransactionFromJson = Schema.fromJsonString(
  UnsignedEvmTransaction
);

export const decodeUnsignedEvmTransactionJson = (tx: string) =>
  Schema.decodeEffect(UnsignedEvmTransactionFromJson)(tx);

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
  decodeUnsignedEvmTransactionJson(tx).pipe(
    Effect.map((decodedTx) => prepareDecodedEvmTransaction(decodedTx, address))
  );
