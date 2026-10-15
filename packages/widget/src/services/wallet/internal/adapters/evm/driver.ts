import { Effect } from "effect";
import type { Address } from "viem";
import type { Connector } from "wagmi";
import { WalletDecodeError } from "../../../wallet-errors";
import type { WalletEvmTransactionInput } from "../../../wallet-transactions";
import type { WagmiActions } from "../../runtime/wagmi-actions";
import {
  decodeUnsignedEvmTransactionJson,
  type unsignedEVMTransactionCodec,
} from "./transaction";

const prepareEvmTransaction = (
  decodedTx: typeof unsignedEVMTransactionCodec.Type
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

export const decodeEvmTransaction = (
  tx: string
): Effect.Effect<WalletEvmTransactionInput, WalletDecodeError> =>
  decodeUnsignedEvmTransactionJson(tx).pipe(
    Effect.mapError((cause) => new WalletDecodeError({ cause })),
    Effect.map(prepareEvmTransaction)
  );

/**
 * Borrow omits the quoted gas limit so the wallet estimates it at signing
 * time: the API quotes every step before earlier steps land, so its limit can
 * fall short once approvals and supplies change the position.
 */
export const decodeBorrowEvmTransaction = (tx: string) =>
  decodeEvmTransaction(tx).pipe(
    Effect.map(({ gas: _quotedGas, ...input }) => input)
  );

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
