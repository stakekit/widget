import { Effect, Result, Schema } from "effect";
import type { Address } from "viem";
import type { Connector } from "wagmi";
import type { Network } from "../../../domain/schema/network-model";
import {
  isBittensorChain,
  isEvmChain,
  isSolanaChain,
  isTonChain,
  isTronChain,
} from "../../../domain/types/chains";

import {
  decodeAndPrepareEvmTransaction,
  normalizeSolanaTransactionToHex,
  normalizeTonTransactionToRaw,
  substratePayloadCodec,
  unsignedSolanaTransactionCodec,
  unsignedTonTransactionCodec,
  unsignedTronTransactionCodec,
} from "../../../domain/types/transaction";
import type {
  BittensorTx,
  SKBorrowTxMeta,
  SKTx,
  SKTxMeta,
  TronTx,
} from "../../../public-api/types";
import { isExternalProviderConnector } from "../connectors/external-provider";
import {
  WalletBroadcastError,
  WalletCapabilityUnavailableError,
  WalletDecodeError,
  WalletSigningError,
} from "../domain/errors";
import type { WalletBroadcastResult } from "../domain/transactions";

const decodeSchema = <S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
  input: unknown
): Result.Result<S["Type"], string> =>
  Schema.decodeUnknownResult(schema)(input).pipe(
    Result.mapError((error) => error.message)
  );

const tryResult = <A>(
  evaluate: () => A,
  message: string
): Result.Result<A, string> => {
  try {
    return Result.succeed(evaluate());
  } catch {
    return Result.fail(message);
  }
};

const decodeExternalProviderTransaction = ({
  address,
  network,
  tx,
}: {
  readonly address: Address;
  readonly network: Network;
  readonly tx: string;
}): Effect.Effect<SKTx, WalletDecodeError> => {
  const result: Result.Result<SKTx, string> = (() => {
    if (isEvmChain(network)) {
      return decodeAndPrepareEvmTransaction({ address, tx }).pipe(
        Result.mapError((error) => error.message),
        Result.map((decodedTx) => ({ type: "evm", tx: decodedTx }))
      );
    }

    if (isSolanaChain(network)) {
      return decodeSchema(unsignedSolanaTransactionCodec, tx).pipe(
        Result.map((decodedTx) => ({
          type: "solana",
          tx: normalizeSolanaTransactionToHex(decodedTx),
        }))
      );
    }

    if (isTonChain(network)) {
      return decodeSchema(
        Schema.fromJsonString(unsignedTonTransactionCodec),
        tx
      ).pipe(
        Result.flatMap((decodedTx) =>
          tryResult(
            () => normalizeTonTransactionToRaw(decodedTx),
            "Failed to normalize TON tx"
          )
        ),
        Result.map((decodedTx) => ({ type: "ton", tx: decodedTx }))
      );
    }

    if (isTronChain(network)) {
      return decodeSchema(
        Schema.fromJsonString(unsignedTronTransactionCodec),
        tx
      ).pipe(
        Result.map((decodedTx) => ({ type: "tron", tx: decodedTx }) as TronTx)
      );
    }

    if (isBittensorChain(network)) {
      return decodeSchema(
        Schema.fromJsonString(substratePayloadCodec),
        tx
      ).pipe(
        Result.map(
          (decodedTx) => ({ type: "bittensor", tx: decodedTx }) as BittensorTx
        )
      );
    }

    return Result.fail("Unsupported network");
  })();

  return Result.isFailure(result)
    ? Effect.fail(new WalletDecodeError({ cause: result.failure }))
    : Effect.succeed(result.success);
};

type ExternalProviderTransactionInput = {
  readonly address: Address;
  readonly network: Network;
  readonly tx: string;
} & (
  | {
      readonly family: "classic";
      readonly txMeta: SKTxMeta;
    }
  | {
      readonly family: "borrow";
      readonly txMeta: SKBorrowTxMeta;
    }
);

export const makeExternalProviderWalletDriver = ({
  connector,
}: {
  readonly connector: Connector;
}) => ({
  signMessage: ({
    message,
  }: {
    readonly message: string;
  }): Effect.Effect<
    string,
    WalletCapabilityUnavailableError | WalletSigningError
  > =>
    Effect.gen(function* () {
      if (!isExternalProviderConnector(connector)) {
        return yield* Effect.fail(
          new WalletCapabilityUnavailableError({
            capability: "message",
            connectorId: connector.id,
          })
        );
      }

      return yield* connector
        .signMessage(message)
        .pipe(
          Effect.mapError(
            (cause) => new WalletSigningError({ cause, operation: "message" })
          )
        );
    }),
  signTransaction: (
    input: ExternalProviderTransactionInput
  ): Effect.Effect<
    WalletBroadcastResult,
    WalletBroadcastError | WalletCapabilityUnavailableError | WalletDecodeError
  > =>
    Effect.gen(function* () {
      if (!isExternalProviderConnector(connector)) {
        return yield* Effect.fail(
          new WalletCapabilityUnavailableError({
            capability: "transaction",
            connectorId: connector.id,
          })
        );
      }

      const decodedTx = yield* decodeExternalProviderTransaction({
        address: input.address,
        network: input.network,
        tx: input.tx,
      });
      const sendTransaction =
        input.family === "borrow"
          ? connector.sendBorrowTransaction(decodedTx, input.txMeta)
          : connector.sendTransaction(decodedTx, input.txMeta);
      const signedTx = yield* sendTransaction.pipe(
        Effect.mapError(
          (cause) =>
            new WalletBroadcastError({
              cause,
              customMessage: cause.customMessage,
            })
        )
      );

      return { broadcasted: true, signedTx } satisfies WalletBroadcastResult;
    }),
});
