import { Effect } from "effect";
import type { Address } from "viem";
import type { Connector } from "wagmi";
import { WalletDecodeError } from "../../../wallet-errors";
import type { WalletEvmTransactionInput } from "../../../wallet-transactions";
import type { WagmiActions } from "../../runtime/wagmi-actions";
import { decodeUnsignedEvmTransactionJson } from "./transaction";

export const decodeEvmTransaction = (
  tx: string
): Effect.Effect<WalletEvmTransactionInput, WalletDecodeError> =>
  decodeUnsignedEvmTransactionJson(tx).pipe(
    Effect.mapError((cause) => new WalletDecodeError({ cause })),
    Effect.map((decodedTx) => {
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
