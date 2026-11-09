import { Effect } from "effect";
import type { Connector } from "wagmi";
import {
  WalletBroadcastError,
  WalletCapabilityUnavailableError,
  WalletSigningError,
} from "../../wallet-errors";
import {
  decodeWalletBroadcastResult,
  decodeWalletSignedPayloadResult,
  type WalletBroadcastResult,
  type WalletSignedPayloadResult,
} from "../../wallet-transactions";

/**
 * The driver's signer for this connector, or a failure saying the connector
 * cannot sign transactions when the driver's guard yielded `null`.
 */
export const requireTransactionSigner = <A>(
  connector: Connector,
  signer: A | null
): Effect.Effect<A, WalletCapabilityUnavailableError> =>
  signer === null
    ? Effect.fail(
        new WalletCapabilityUnavailableError({
          capability: "transaction",
          connectorId: connector.id,
        })
      )
    : Effect.succeed(signer);

/** A transaction the wallet signed and returned without broadcasting. */
export const signedPayloadResult = <E, R>(
  sign: Effect.Effect<unknown, E, R>
): Effect.Effect<WalletSignedPayloadResult, WalletSigningError, R> =>
  sign.pipe(
    Effect.mapError(
      (cause) => new WalletSigningError({ cause, operation: "transaction" })
    ),
    Effect.flatMap(decodeWalletSignedPayloadResult)
  );

/** A transaction the wallet signed and broadcast itself. */
export const broadcastResult = <E, R>(
  sign: Effect.Effect<unknown, E, R>
): Effect.Effect<WalletBroadcastResult, WalletBroadcastError, R> =>
  sign.pipe(
    Effect.mapError(
      (cause) => new WalletBroadcastError({ cause, customMessage: null })
    ),
    Effect.flatMap(decodeWalletBroadcastResult)
  );
