import { Effect, Schema, SchemaTransformation } from "effect";
import { type Address, type Hex, hexToBigInt, isHex, numberToHex } from "viem";
import { ExactBaseUnitAmount } from "../../../../../domain/finance/scalars";

const HexString = Schema.declare<Hex>(
  (input): input is Hex => typeof input === "string" && input.startsWith("0x"),
  { expected: "a 0x-prefixed hex string" }
);
/** An EVM account as wallets and the API quote it: a 0x-prefixed string. */
export const isEvmAddress = (input: unknown): input is Address =>
  typeof input === "string" && input.startsWith("0x");
const EvmAddress = Schema.declare<Address>(isEvmAddress, {
  expected: "a 0x-prefixed address",
});

/**
 * EVM nodes quote transaction quantities as hex, while the API quotes them as
 * decimal strings or safe integers.
 */
const HexQuantity = Schema.String.pipe(
  Schema.refine((value): value is Hex => isHex(value) && value.length > 2, {
    message: "expected a 0x-prefixed hex quantity",
  }),
  Schema.decodeTo(
    Schema.BigInt,
    SchemaTransformation.transform({
      decode: (value) => hexToBigInt(value),
      encode: (value) => numberToHex(value),
    })
  )
);
const EvmBaseUnitQuantity = Schema.Union([ExactBaseUnitAmount, HexQuantity]);

/** The wallet always selects the nonce, so a quoted `nonce` is ignored. */
const UnsignedEvmTransaction = Schema.Struct({
  data: HexString,
  to: EvmAddress,
  gasLimit: EvmBaseUnitQuantity,
  from: EvmAddress,
  value: Schema.optionalKey(EvmBaseUnitQuantity),
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

const optionalHex = (value: bigint | undefined) =>
  value === undefined ? undefined : numberToHex(value);

const prepareDecodedEvmTransactionBase = (
  decodedTx: typeof UnsignedEvmTransaction.Type,
  address: Address
) => ({
  to: decodedTx.to,
  from: address,
  data: decodedTx.data,
  value: decodedTx.value ? numberToHex(decodedTx.value) : undefined,
  gas: numberToHex(decodedTx.gasLimit),
  chainId: numberToHex(decodedTx.chainId),
});

type DecodedEvmTransaction = typeof UnsignedEvmTransaction.Type;

const decodeAndPrepareWith =
  <Fees>(prepareFees: (decodedTx: DecodedEvmTransaction) => Fees) =>
  ({ address, tx }: { address: Address; tx: string }) =>
    decodeUnsignedEvmTransactionJson(tx).pipe(
      Effect.map((decodedTx) => ({
        ...prepareDecodedEvmTransactionBase(decodedTx, address),
        ...prepareFees(decodedTx),
      }))
    );

export const decodeAndPrepareEvmTransaction = decodeAndPrepareWith(
  (decodedTx) =>
    decodedTx.maxFeePerGas
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
        }
);

/** Borrow keeps the API's transaction type and passes quoted fees through. */
export const decodeAndPrepareBorrowEvmTransaction = decodeAndPrepareWith(
  (decodedTx) =>
    decodedTx.type === 2
      ? {
          type: "0x2" as const,
          maxFeePerGas: optionalHex(decodedTx.maxFeePerGas),
          maxPriorityFeePerGas: optionalHex(decodedTx.maxPriorityFeePerGas),
        }
      : {
          type: "0x0" as const,
          gasPrice: optionalHex(decodedTx.gasPrice),
        }
);
