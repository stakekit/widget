import { Effect, Schema } from "effect";
import type { Connector } from "wagmi";
import {
  unsignedSolanaTransactionCodec,
  unsignedTronTransactionCodec,
} from "../../../domain/types/transaction";
import { isCardanoConnector } from "../../misc/cardano-connector-meta";
import { isSolanaConnector } from "../../misc/solana-connector-meta";
import { isTonConnector } from "../../misc/ton-connector-meta";
import { isTronConnector } from "../../misc/tron-connector-meta";
import {
  WalletBroadcastError,
  WalletCapabilityUnavailableError,
  WalletDecodeError,
  WalletSigningError,
} from "../domain/errors";
import type {
  WalletBroadcastResult,
  WalletSignedPayloadResult,
} from "../domain/transactions";

type SignedPayloadDriverError =
  | WalletCapabilityUnavailableError
  | WalletDecodeError
  | WalletSigningError;

type BroadcastDriverError =
  | WalletBroadcastError
  | WalletCapabilityUnavailableError
  | WalletDecodeError;

export const makeTronWalletDriver = ({
  connector,
}: {
  readonly connector: Connector;
}) => ({
  signTransaction: ({
    tx,
  }: {
    readonly tx: string;
  }): Effect.Effect<WalletSignedPayloadResult, SignedPayloadDriverError> =>
    Effect.gen(function* () {
      if (!isTronConnector(connector)) {
        return yield* Effect.fail(
          new WalletCapabilityUnavailableError({
            capability: "transaction",
            connectorId: connector.id,
          })
        );
      }

      const decodedTx = yield* Schema.decodeEffect(
        Schema.fromJsonString(unsignedTronTransactionCodec)
      )(tx).pipe(Effect.mapError((cause) => new WalletDecodeError({ cause })));
      const signed = yield* Effect.tryPromise({
        try: () => connector.signTransaction(decodedTx),
        catch: (cause) =>
          new WalletSigningError({ cause, operation: "transaction" }),
      });
      const signedTx = yield* Effect.try({
        try: () => JSON.stringify(signed),
        catch: (cause) =>
          new WalletSigningError({ cause, operation: "transaction" }),
      });

      return { broadcasted: false, signedTx };
    }),
});

export const makeSolanaWalletDriver = ({
  connector,
}: {
  readonly connector: Connector;
}) => ({
  signTransaction: ({
    tx,
  }: {
    readonly tx: string;
  }): Effect.Effect<WalletBroadcastResult, BroadcastDriverError> =>
    Effect.gen(function* () {
      if (!isSolanaConnector(connector)) {
        return yield* Effect.fail(
          new WalletCapabilityUnavailableError({
            capability: "transaction",
            connectorId: connector.id,
          })
        );
      }

      const decodedTx = yield* Schema.decodeEffect(
        unsignedSolanaTransactionCodec
      )(tx).pipe(Effect.mapError((cause) => new WalletDecodeError({ cause })));
      const signedTx = yield* Effect.tryPromise({
        try: () => connector.sendTransaction(decodedTx),
        catch: (cause) =>
          new WalletBroadcastError({ cause, customMessage: null }),
      });

      return { broadcasted: true, signedTx };
    }),
});

export const makeCardanoWalletDriver = ({
  connector,
}: {
  readonly connector: Connector;
}) => ({
  signTransaction: ({
    tx,
  }: {
    readonly tx: string;
  }): Effect.Effect<
    WalletSignedPayloadResult,
    WalletCapabilityUnavailableError | WalletSigningError
  > =>
    Effect.gen(function* () {
      if (!isCardanoConnector(connector)) {
        return yield* Effect.fail(
          new WalletCapabilityUnavailableError({
            capability: "transaction",
            connectorId: connector.id,
          })
        );
      }

      const signedTx = yield* connector
        .signTransaction(tx)
        .pipe(
          Effect.mapError(
            (cause) =>
              new WalletSigningError({ cause, operation: "transaction" })
          )
        );

      return { broadcasted: false, signedTx };
    }),
});

export const makeTonWalletDriver = ({
  connector,
}: {
  readonly connector: Connector;
}) => ({
  signTransaction: ({
    tx,
  }: {
    readonly tx: string;
  }): Effect.Effect<
    WalletBroadcastResult,
    WalletBroadcastError | WalletCapabilityUnavailableError
  > =>
    Effect.gen(function* () {
      if (!isTonConnector(connector)) {
        return yield* Effect.fail(
          new WalletCapabilityUnavailableError({
            capability: "transaction",
            connectorId: connector.id,
          })
        );
      }

      const signedTx = yield* connector
        .signTransaction(tx)
        .pipe(
          Effect.mapError(
            (cause) => new WalletBroadcastError({ cause, customMessage: null })
          )
        );

      return { broadcasted: true, signedTx };
    }),
});
