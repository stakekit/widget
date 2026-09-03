import { Effect, Result, Schema } from "effect";
import type { Address } from "viem";
import type { Connector } from "wagmi";
import type { Network } from "../../../../../domain/network/network";
import { isEvmWalletNetwork } from "../../../../../domain/wallet/network";
import type {
  BittensorTx,
  SKBorrowTx,
  SKBorrowTxMeta,
  SKTx,
  SKTxMeta,
  TronTx,
} from "../../../../../public-api/types";
import type { ExternalProviderError } from "../../../external-provider";
import type { WalletSignTypedDataInput } from "../../../wallet-commands";
import {
  WalletBroadcastError,
  WalletCapabilityUnavailableError,
  WalletDecodeError,
  WalletSigningError,
} from "../../../wallet-errors";
import type { WalletBroadcastResult } from "../../../wallet-transactions";
import {
  decodeAndPrepareBorrowEvmTransaction,
  decodeAndPrepareEvmTransaction,
} from "../evm/transaction";
import {
  normalizeSolanaTransactionToHex,
  unsignedSolanaTransactionCodec,
} from "../solana/transaction";
import { substratePayloadCodec } from "../substrate/transaction";
import {
  normalizeTonTransactionToRaw,
  unsignedTonTransactionCodec,
} from "../ton/transaction";
import { unsignedTronTransactionCodec } from "../tron/transaction";
import { isExternalProviderConnector } from "./index";

const toWalletBroadcastError = (cause: ExternalProviderError) =>
  new WalletBroadcastError({
    cause,
    customMessage: cause.customMessage,
  });

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
  if (isEvmWalletNetwork(network)) {
    return decodeAndPrepareEvmTransaction({ address, tx }).pipe(
      Effect.map((decodedTx): SKTx => ({ type: "evm", tx: decodedTx })),
      Effect.mapError((cause) => new WalletDecodeError({ cause }))
    );
  }

  const result: Result.Result<SKTx, string> = (() => {
    if (network === "solana") {
      return decodeSchema(unsignedSolanaTransactionCodec, tx).pipe(
        Result.map((decodedTx) => ({
          type: "solana",
          tx: normalizeSolanaTransactionToHex(decodedTx),
        }))
      );
    }

    if (network === "ton") {
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

    if (network === "tron") {
      return decodeSchema(
        Schema.fromJsonString(unsignedTronTransactionCodec),
        tx
      ).pipe(
        Result.map((decodedTx) => ({ type: "tron", tx: decodedTx }) as TronTx)
      );
    }

    if (network === "bittensor") {
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

const decodeBorrowExternalProviderTransaction = ({
  address,
  network,
  tx,
}: {
  readonly address: Address;
  readonly network: Network;
  readonly tx: string;
}): Effect.Effect<SKBorrowTx, WalletDecodeError> => {
  if (!isEvmWalletNetwork(network)) {
    return Effect.fail(
      new WalletDecodeError({ cause: "Unsupported Borrow network" })
    );
  }

  return decodeAndPrepareBorrowEvmTransaction({ address, tx }).pipe(
    Effect.map((decodedTx): SKBorrowTx => ({ type: "evm", tx: decodedTx })),
    Effect.mapError((cause) => new WalletDecodeError({ cause }))
  );
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
        return yield* new WalletCapabilityUnavailableError({
          capability: "message",
          connectorId: connector.id,
        });
      }

      return yield* connector
        .signMessage(message)
        .pipe(
          Effect.mapError(
            (cause) => new WalletSigningError({ cause, operation: "message" })
          )
        );
    }),
  signTypedData: (
    input: WalletSignTypedDataInput
  ): Effect.Effect<
    string,
    WalletCapabilityUnavailableError | WalletSigningError
  > =>
    Effect.gen(function* () {
      if (!isExternalProviderConnector(connector)) {
        return yield* new WalletCapabilityUnavailableError({
          capability: "typed-data",
          connectorId: connector.id,
        });
      }

      return yield* connector
        .signTypedData(input)
        .pipe(
          Effect.mapError(
            (cause) =>
              new WalletSigningError({ cause, operation: "typed-data" })
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
        return yield* new WalletCapabilityUnavailableError({
          capability: "transaction",
          connectorId: connector.id,
        });
      }

      const signedTx = yield* Effect.gen(function* () {
        if (input.family === "borrow") {
          const decodedTx = yield* decodeBorrowExternalProviderTransaction({
            address: input.address,
            network: input.network,
            tx: input.tx,
          });
          return yield* connector
            .sendBorrowTransaction(decodedTx, input.txMeta)
            .pipe(Effect.mapError(toWalletBroadcastError));
        }

        const decodedTx = yield* decodeExternalProviderTransaction({
          address: input.address,
          network: input.network,
          tx: input.tx,
        });
        return yield* connector
          .sendTransaction(decodedTx, input.txMeta)
          .pipe(Effect.mapError(toWalletBroadcastError));
      });

      return { broadcasted: true, signedTx } satisfies WalletBroadcastResult;
    }),
});
