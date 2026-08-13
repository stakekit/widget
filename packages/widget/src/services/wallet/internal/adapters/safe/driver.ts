import { Data, Effect, Result, Schedule } from "effect";
import type { Address } from "viem";
import type { Connector } from "wagmi";
import {
  WalletBroadcastError,
  WalletCapabilityUnavailableError,
  WalletDecodeError,
} from "../../../wallet-errors";
import type { WalletBroadcastResult } from "../../../wallet-transactions";
import { decodeAndPrepareEvmTransaction } from "../evm/transaction";
import { isSafeConnector } from "./safe-connector-meta";

class SafeConfirmationPendingError extends Data.TaggedError(
  "SafeConfirmationPendingError"
)<{
  readonly safeTxHash: string;
}> {}

export const makeSafeWalletDriver = ({
  confirmationRetries = 120,
  confirmationSchedule = Schedule.spaced("7 seconds"),
  connector,
}: {
  readonly confirmationRetries?: number;
  readonly confirmationSchedule?: ReturnType<typeof Schedule.spaced>;
  readonly connector: Connector;
}) => ({
  signTransaction: ({
    address,
    tx,
  }: {
    readonly address: Address;
    readonly tx: string;
  }): Effect.Effect<
    WalletBroadcastResult,
    WalletBroadcastError | WalletCapabilityUnavailableError | WalletDecodeError
  > =>
    Effect.gen(function* () {
      if (!isSafeConnector(connector)) {
        return yield* Effect.fail(
          new WalletCapabilityUnavailableError({
            capability: "transaction",
            connectorId: connector.id,
          })
        );
      }

      const decodedResult = decodeAndPrepareEvmTransaction({ address, tx });
      const decodedTx = Result.isFailure(decodedResult)
        ? yield* Effect.fail(
            new WalletDecodeError({ cause: decodedResult.failure })
          )
        : decodedResult.success;
      const response = yield* connector
        .sendTransactions({
          txs: [
            {
              data: decodedTx.data,
              to: decodedTx.to,
              value: decodedTx.value ?? "0",
            },
          ],
        })
        .pipe(
          Effect.mapError(
            (cause) => new WalletBroadcastError({ cause, customMessage: null })
          )
        );
      const signedTx = yield* Effect.gen(function* () {
        const status = yield* connector
          .getTxStatus(response.safeTxHash)
          .pipe(
            Effect.mapError(
              (cause) =>
                new WalletBroadcastError({ cause, customMessage: null })
            )
          );

        if (status.txHash && status.txStatus === connector.txStatus.SUCCESS) {
          return status.txHash;
        }

        if (
          status.txStatus === connector.txStatus.FAILED ||
          status.txStatus === connector.txStatus.CANCELLED
        ) {
          return yield* Effect.fail(
            new WalletBroadcastError({ cause: status, customMessage: null })
          );
        }

        return yield* Effect.fail(
          new SafeConfirmationPendingError({
            safeTxHash: response.safeTxHash,
          })
        );
      }).pipe(
        Effect.retry({
          schedule: confirmationSchedule,
          times: confirmationRetries,
          while: (error) => error._tag === "SafeConfirmationPendingError",
        }),
        Effect.mapError((error) =>
          error._tag === "SafeConfirmationPendingError"
            ? new WalletBroadcastError({ cause: error, customMessage: null })
            : error
        )
      );

      return { broadcasted: true, signedTx };
    }),
});
