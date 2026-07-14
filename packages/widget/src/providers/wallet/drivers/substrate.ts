import { Effect, Schema } from "effect";
import type { Connector } from "wagmi";
import { substratePayloadCodec } from "../../../domain/types/transaction";
import { isSubstrateConnector } from "../../substrate/substrate-connector-meta";
import {
  WalletCapabilityUnavailableError,
  WalletDecodeError,
  WalletSigningError,
} from "../domain/errors";

export const makeSubstrateWalletDriver = ({
  connector,
}: {
  readonly connector: Connector;
}) => ({
  signTransaction: ({ tx }: { readonly tx: string }) =>
    Effect.gen(function* () {
      if (!isSubstrateConnector(connector)) {
        return yield* Effect.fail(
          new WalletCapabilityUnavailableError({
            capability: "transaction",
            connectorId: connector.id,
          })
        );
      }

      const payload = yield* Schema.decodeEffect(
        Schema.fromJsonString(substratePayloadCodec)
      )(tx).pipe(Effect.mapError((cause) => new WalletDecodeError({ cause })));
      const signedTx = yield* connector
        .signTransaction({
          ...payload,
          rawTx: tx,
          tx: {
            ...payload.tx,
            signedExtensions: [...payload.tx.signedExtensions],
          },
        })
        .pipe(
          Effect.mapError(
            (cause) =>
              new WalletSigningError({ cause, operation: "transaction" })
          )
        );

      return { broadcasted: false, signedTx };
    }),
});
