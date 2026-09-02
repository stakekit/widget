import { Effect } from "effect";
import type { Address } from "viem";
import type { Connector } from "wagmi";
import { WalletDecodeError } from "../../../wallet-errors";
import type { WalletEvmTransactionInput } from "../../../wallet-transactions";
import type { WagmiActions } from "../../runtime/wagmi-actions";
import {
  decodeUnsignedBorrowEvmTransactionJson,
  decodeUnsignedEvmTransactionJson,
  type unsignedBorrowEVMTransactionCodec,
} from "./transaction";

const prepareEvmTransaction = (
  decodedTx: typeof unsignedBorrowEVMTransactionCodec.Type
): WalletEvmTransactionInput => {
  const transaction = {
    chainId: decodedTx.chainId,
    data: decodedTx.data,
    gas: decodedTx.gasLimit,
    to: decodedTx.to,
    value: decodedTx.value,
  };

  return decodedTx.maxFeePerGas !== undefined
    ? {
        ...transaction,
        maxFeePerGas: decodedTx.maxFeePerGas,
        maxPriorityFeePerGas: decodedTx.maxPriorityFeePerGas,
        type: "eip1559" as const,
      }
    : {
        ...transaction,
        gasPrice: decodedTx.gasPrice,
        type: "legacy" as const,
      };
};

const decodeEvmTransactionWith = (
  decode: typeof decodeUnsignedBorrowEvmTransactionJson,
  tx: string
): Effect.Effect<WalletEvmTransactionInput, WalletDecodeError> =>
  decode(tx).pipe(
    Effect.mapError((cause) => new WalletDecodeError({ cause })),
    Effect.map(prepareEvmTransaction)
  );

export const decodeEvmTransaction = (tx: string) =>
  decodeEvmTransactionWith(decodeUnsignedEvmTransactionJson, tx);

export const decodeBorrowEvmTransaction = (tx: string) =>
  decodeEvmTransactionWith(decodeUnsignedBorrowEvmTransactionJson, tx);

export const makeEvmWalletDriver = ({
  sendTransaction,
}: {
  readonly sendTransaction: WagmiActions["sendEvmTransaction"];
}) => ({
  signTransaction: ({
    account,
    connector,
    family,
    tx,
  }: {
    readonly account?: Address;
    readonly connector?: Connector;
    readonly family: "borrow" | "classic";
    readonly tx: string;
  }) => {
    const decode =
      family === "borrow" ? decodeBorrowEvmTransaction : decodeEvmTransaction;

    return decode(tx).pipe(
      Effect.flatMap((input) =>
        sendTransaction({ ...input, account, connector })
      )
    );
  },
});
