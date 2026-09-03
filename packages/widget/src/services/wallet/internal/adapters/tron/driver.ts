import { Effect, Schema } from "effect";
import type { Connector } from "wagmi";
import {
  WalletCapabilityUnavailableError,
  WalletDecodeError,
  WalletSigningError,
} from "../../../wallet-errors";
import type { WalletSignedPayloadResult } from "../../../wallet-transactions";
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
      if (!isTronConnector(connector)) {
        return yield* new WalletCapabilityUnavailableError({
          capability: "transaction",
          connectorId: connector.id,
        });
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
