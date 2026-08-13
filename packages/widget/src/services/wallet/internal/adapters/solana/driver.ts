import { Effect, Schema } from "effect";
import type { Connector } from "wagmi";
import {
  WalletBroadcastError,
  WalletCapabilityUnavailableError,
  WalletDecodeError,
} from "../../../wallet-errors";
import type { WalletBroadcastResult } from "../../../wallet-transactions";
import { isSolanaConnector } from "./solana-connector-meta";
import { unsignedSolanaTransactionCodec } from "./transaction";

export const makeSolanaWalletDriver = ({
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
    WalletBroadcastError | WalletCapabilityUnavailableError | WalletDecodeError
  > =>
    Effect.gen(function* () {
      if (!isSolanaConnector(connector)) {
        return yield* new WalletCapabilityUnavailableError({
          capability: "transaction",
          connectorId: connector.id,
        });
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
