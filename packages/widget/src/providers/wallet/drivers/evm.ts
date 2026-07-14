import { Effect, Schema } from "effect";
import type { Address } from "viem";
import type { Connector } from "wagmi";
import { unsignedEVMTransactionCodec } from "../../../domain/types/transaction";
import { WalletDecodeError } from "../domain/errors";
import type { WalletEvmTransactionInput } from "../domain/transactions";
import type { WagmiActions } from "../wagmi/actions";

export const decodeEvmTransaction = (
  tx: string
): Effect.Effect<WalletEvmTransactionInput, WalletDecodeError> =>
  Schema.decodeEffect(Schema.fromJsonString(unsignedEVMTransactionCodec))(
    tx
  ).pipe(
    Effect.mapError((cause) => new WalletDecodeError({ cause })),
    Effect.map((decodedTx): WalletEvmTransactionInput => {
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
            type: "eip1559",
          }
        : {
            ...transaction,
            gasPrice: decodedTx.gasPrice,
            type: "legacy",
          };
    })
  );

export const makeEvmWalletDriver = ({
  sendTransaction,
}: {
  readonly sendTransaction: WagmiActions["sendEvmTransaction"];
}) => ({
  signTransaction: ({
    account,
    connector,
    tx,
  }: {
    readonly account?: Address;
    readonly connector?: Connector;
    readonly tx: string;
  }) =>
    decodeEvmTransaction(tx).pipe(
      Effect.flatMap((input) =>
        sendTransaction({ ...input, account, connector })
      )
    ),
});
