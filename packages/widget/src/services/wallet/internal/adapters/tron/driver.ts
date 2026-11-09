import { Effect, Schema } from "effect";
import type { Connector } from "wagmi";

import {
  type WalletCapabilityUnavailableError,
  WalletDecodeError,
  WalletSigningError,
} from "../../../wallet-errors";
import {
  decodeWalletSignedPayloadResult,
  type WalletSignedPayloadResult,
} from "../../../wallet-transactions";
import { requireTransactionSigner } from "../transaction-signing";
import { unsignedTronTransactionCodec } from "./transaction";
import { isTronConnector } from "./tron-connector-meta";

export const makeTronWalletDriver = ({
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
    WalletCapabilityUnavailableError | WalletDecodeError | WalletSigningError
  > =>
    Effect.gen(function* () {
      const tron = yield* requireTransactionSigner(
        connector,
        isTronConnector(connector) ? connector : null
      );
      const decodedTx = yield* Schema.decodeEffect(
        Schema.fromJsonString(unsignedTronTransactionCodec)
      )(tx).pipe(Effect.mapError((cause) => new WalletDecodeError({ cause })));

      const signed = yield* Effect.tryPromise({
        try: () => tron.signTransaction(decodedTx),
        catch: (cause) =>
          new WalletSigningError({ cause, operation: "transaction" }),
      });
      const signedTx = yield* Schema.encodeEffect(
        Schema.fromJsonString(Schema.Unknown)
      )(signed).pipe(
        Effect.mapError(
          (cause) => new WalletSigningError({ cause, operation: "transaction" })
        )
      );

      return yield* decodeWalletSignedPayloadResult(signedTx);
    }),
});
